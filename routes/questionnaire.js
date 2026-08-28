const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/db');
const authMiddleware = require('../middleware/auth');
const emailService = require('../services/emailService');
const accessService = require('../services/accessService');
const { generateAndSavePlan } = require('../services/planGenerationService');

// ─── POST /api/questionnaire ─────────────────────────────────
// Guarda respuestas y genera plan personalizado
router.post('/', authMiddleware, [
  body('age').isInt({ min: 15, max: 100 }).withMessage('Edad inválida'),
  body('sex').isIn(['hombre', 'mujer']).withMessage('Sexo inválido'),
  body('weight_kg').isFloat({ min: 30, max: 300 }).withMessage('Peso inválido'),
  body('height_cm').isInt({ min: 100, max: 250 }).withMessage('Altura inválida'),
  body('goal').isIn(['perder_peso', 'ganar_masa', 'mantener', 'mejorar_salud']).withMessage('Objetivo inválido'),
  body('activity_level').isIn(['sedentario', 'ligero', 'moderado', 'activo', 'muy_activo']).withMessage('Nivel de actividad inválido'),
  body('dietary_preference').isIn(['omnivoro', 'vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa']).withMessage('Preferencia dietética inválida'),
  body('training_equipment').optional().isIn(['casa', 'gimnasio', 'mixto']).withMessage('Equipamiento inválido'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    age, sex, weight_kg, height_cm, target_weight_kg,
    goal, activity_level, dietary_preference,
    health_conditions = [], training_experience = 'principiante',
    training_days_per_week = 3, training_equipment = 'mixto',
  } = req.body;

  try {
    const userId = req.user.id;

    // ¿Es la primera vez que el usuario genera su plan?
    const prevResult = await db.query(
      'SELECT id FROM questionnaire_answers WHERE user_id = $1',
      [userId]
    );
    const firstTime = prevResult.rows.length === 0;

    // Nivel de acceso: free (funciones restringidas) o pro (completo por 14 €/mes)
    const access = await accessService.getUserAccess(userId);

    // El plan free está limitado a N regeneraciones: editar y regenerar tras agotarlo
    // bloquea (el pro es ilimitado). La primera generación está permitida siempre.
    if (!firstTime && !access.canRegenerate) {
      return res.status(403).json({
        error: 'Alcanzaste el límite de planes gratuitos. Actualiza a Pro para cambiar tu plan cuando quieras.',
        code: 'REGENERATION_LIMIT',
        access,
      });
    }

    // Guardar respuestas (upsert). updated_at registra la última vez que
    // el usuario registró/actualizó sus valores (para el check-in semanal).
    await db.query(`
      INSERT INTO questionnaire_answers
        (user_id, age, sex, weight_kg, height_cm, target_weight_kg, goal,
         activity_level, dietary_preference, health_conditions,
         training_experience, training_days_per_week, training_equipment, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        age = EXCLUDED.age, sex = EXCLUDED.sex, weight_kg = EXCLUDED.weight_kg,
        height_cm = EXCLUDED.height_cm, target_weight_kg = EXCLUDED.target_weight_kg,
        goal = EXCLUDED.goal, activity_level = EXCLUDED.activity_level,
        dietary_preference = EXCLUDED.dietary_preference,
        health_conditions = EXCLUDED.health_conditions,
        training_experience = EXCLUDED.training_experience,
        training_days_per_week = EXCLUDED.training_days_per_week,
        training_equipment = EXCLUDED.training_equipment,
        updated_at = NOW()
    `, [userId, age, sex, weight_kg, height_cm, target_weight_kg, goal,
      activity_level, dietary_preference, health_conditions,
      training_experience, training_days_per_week, training_equipment]);

    // Generar y guardar el plan. La mejora IA y los suplementos solo aplican
    // si el usuario es Pro (free usa únicamente el motor determinista).
    const answers = {
      age, sex, weight_kg, height_cm, target_weight_kg, goal, activity_level,
      dietary_preference, health_conditions, training_experience,
      training_days_per_week, training_equipment
    };
    const plan = await generateAndSavePlan(userId, answers, { isPro: access.isPro });

    // Enviar el email del plan solo en la primera generación (no en cada actualización)
    // req.user has { id, name, email } from auth middleware
    if (firstTime) {
      emailService.sendNutritionPlanEmail(req.user, plan).catch(err => {
        console.error('Error al enviar el email del plan en background:', err);
      });
    }

    // Registrar la regeneración (al editar el cuestionario). Solo importa para
    // el free, que tiene límite de planes; el pro es ilimitado.
    if (!firstTime) {
      accesServiceSafeIncrement(userId);
    }

    res.json({
      message: firstTime ? 'Plan generado y enviado correctamente' : 'Plan actualizado correctamente',
      access,
      plan: {
        resumen: plan.resumen,
        daily_calories: plan.daily_calories,
        protein_g: plan.protein_g,
        carbs_g: plan.carbs_g,
        fat_g: plan.fat_g,
        supplements: plan.supplements,
        notas_dieta: plan.notas_dieta,
        consejos_generales: plan.consejos_generales,
      }
    });

  } catch (err) {
    console.error('Error en cuestionario:', err);
    res.status(500).json({ error: 'Error generando el plan' });
  }
});

// Incrementa el contador de regeneraciones de forma segura (no rompe el flujo)
async function accesServiceSafeIncrement(userId) {
  try {
    await accessService.incrementRegeneration(userId);
  } catch (err) {
    console.error('Error incrementando regeneraciones:', err);
  }
}

module.exports = router;
