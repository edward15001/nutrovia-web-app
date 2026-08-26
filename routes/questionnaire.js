const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/db');
const authMiddleware = require('../middleware/auth');
const { generatePersonalizedPlan } = require('../controllers/planEngine');
const emailService = require('../services/emailService');
const aiPlanService = require('../services/aiPlanService');

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

    // Generar plan personalizado
    const answers = {
      age, sex, weight_kg, height_cm, target_weight_kg, goal, activity_level,
      dietary_preference, health_conditions, training_experience,
      training_days_per_week, training_equipment
    };
    let plan = generatePersonalizedPlan(answers);

    // ─── Mejora con IA (opcional) ─────────────────────────────
    // Si hay OPENAI_API_KEY configurada, la IA genera el contenido
    // (menú, entrenamiento, suplementos) a partir del perfil. Los macros
    // y las notas de seguridad SIEMPRE provienen del motor determinista.
    // Si la IA falla o tarda demasiado, se usa el plan del motor tal cual.
    if (aiPlanService.isConfigured()) {
      const aiPlan = await aiPlanService.generatePersonalizedPlanWithAI(answers, {
        daily_calories: plan.daily_calories,
        protein_g: plan.protein_g,
        carbs_g: plan.carbs_g,
        fat_g: plan.fat_g,
      });

      if (aiPlan) {
        if (aiPlan.weekly_menu) plan.weekly_menu = aiPlan.weekly_menu;
        if (aiPlan.training_plan) plan.training_plan = aiPlan.training_plan;
        if (Array.isArray(aiPlan.supplements) && aiPlan.supplements.length > 0) {
          plan.supplements = aiPlan.supplements;
        }
        // Notas de salud y consejos: se CONSERVAN las del motor (avisos
        // de seguridad) y se añaden las de la IA sin duplicar.
        if (Array.isArray(aiPlan.notas_dieta)) {
          aiPlan.notas_dieta.forEach(n => {
            if (!plan.notas_dieta.includes(n)) plan.notas_dieta.push(n);
          });
        }
        if (Array.isArray(aiPlan.consejos_generales)) {
          aiPlan.consejos_generales.forEach(n => {
            if (!plan.consejos_generales.includes(n)) plan.consejos_generales.push(n);
          });
        }
      }
    }

    // Guardar plan (upsert)
    await db.query(`
      INSERT INTO nutrition_plans (user_id, daily_calories, protein_g, carbs_g, fat_g, weekly_menu, training_plan, supplements, notas_dieta, consejos_generales)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (user_id) DO UPDATE SET
        daily_calories = EXCLUDED.daily_calories,
        protein_g = EXCLUDED.protein_g,
        carbs_g = EXCLUDED.carbs_g,
        fat_g = EXCLUDED.fat_g,
        weekly_menu = EXCLUDED.weekly_menu,
        training_plan = EXCLUDED.training_plan,
        supplements = EXCLUDED.supplements,
        notas_dieta = EXCLUDED.notas_dieta,
        consejos_generales = EXCLUDED.consejos_generales,
        generated_at = NOW()
    `, [userId, plan.daily_calories, plan.protein_g, plan.carbs_g, plan.fat_g,
      JSON.stringify(plan.weekly_menu), JSON.stringify(plan.training_plan),
      JSON.stringify(plan.supplements), JSON.stringify(plan.notas_dieta),
      JSON.stringify(plan.consejos_generales)]);

    // Enviar el email del plan solo en la primera generación (no en cada actualización)
    // req.user has { id, name, email } from auth middleware
    if (firstTime) {
      emailService.sendNutritionPlanEmail(req.user, plan).catch(err => {
        console.error('Error al enviar el email del plan en background:', err);
      });
    }

    res.json({
      message: firstTime ? 'Plan generado y enviado correctamente' : 'Plan actualizado correctamente',
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

module.exports = router;
