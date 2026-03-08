const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/db');
const authMiddleware = require('../middleware/auth');
const { generatePersonalizedPlan } = require('../controllers/planEngine');
const emailService = require('../services/emailService');

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
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    age, sex, weight_kg, height_cm, target_weight_kg,
    goal, activity_level, dietary_preference,
    health_conditions = [], training_experience = 'principiante',
    training_days_per_week = 3,
  } = req.body;

  try {
    const userId = req.user.id;

    // Guardar respuestas (upsert)
    await db.query(`
      INSERT INTO questionnaire_answers
        (user_id, age, sex, weight_kg, height_cm, target_weight_kg, goal,
         activity_level, dietary_preference, health_conditions,
         training_experience, training_days_per_week)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (user_id) DO UPDATE SET
        age = EXCLUDED.age, sex = EXCLUDED.sex, weight_kg = EXCLUDED.weight_kg,
        height_cm = EXCLUDED.height_cm, target_weight_kg = EXCLUDED.target_weight_kg,
        goal = EXCLUDED.goal, activity_level = EXCLUDED.activity_level,
        dietary_preference = EXCLUDED.dietary_preference,
        health_conditions = EXCLUDED.health_conditions,
        training_experience = EXCLUDED.training_experience,
        training_days_per_week = EXCLUDED.training_days_per_week,
        created_at = NOW()
    `, [userId, age, sex, weight_kg, height_cm, target_weight_kg, goal,
      activity_level, dietary_preference, health_conditions,
      training_experience, training_days_per_week]);

    // Generar plan personalizado
    const answers = {
      age, sex, weight_kg, height_cm, goal, activity_level,
      dietary_preference, health_conditions, training_experience,
      training_days_per_week
    };
    const plan = generatePersonalizedPlan(answers);

    // Guardar plan (upsert)
    await db.query(`
      INSERT INTO nutrition_plans (user_id, daily_calories, protein_g, carbs_g, fat_g, weekly_menu, training_plan, supplements)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (user_id) DO UPDATE SET
        daily_calories = EXCLUDED.daily_calories,
        protein_g = EXCLUDED.protein_g,
        carbs_g = EXCLUDED.carbs_g,
        fat_g = EXCLUDED.fat_g,
        weekly_menu = EXCLUDED.weekly_menu,
        training_plan = EXCLUDED.training_plan,
        supplements = EXCLUDED.supplements,
        generated_at = NOW()
    `, [userId, plan.daily_calories, plan.protein_g, plan.carbs_g, plan.fat_g,
      JSON.stringify(plan.weekly_menu), JSON.stringify(plan.training_plan),
      JSON.stringify(plan.supplements)]);

    // Enviar el email al usuario
    // req.user has { id, name, email } from auth middleware
    emailService.sendNutritionPlanEmail(req.user, plan).catch(err => {
      console.error('Error al enviar el email del plan en background:', err);
    });

    res.json({
      message: 'Plan generado y enviado correctamente',
      plan: {
        resumen: plan.resumen,
        daily_calories: plan.daily_calories,
        protein_g: plan.protein_g,
        carbs_g: plan.carbs_g,
        fat_g: plan.fat_g,
        supplements: plan.supplements,
        consejos_generales: plan.consejos_generales,
      }
    });

  } catch (err) {
    console.error('Error en cuestionario:', err);
    res.status(500).json({ error: 'Error generando el plan' });
  }
});

// Permitir solo un registro en questionnaire_answers por usuario
// Añadir UNIQUE constraint si no está en el schema
(async () => {
  try {
    const db2 = require('../db/db');
    await db2.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'questionnaire_answers_user_id_key'
        ) THEN
          ALTER TABLE questionnaire_answers ADD CONSTRAINT questionnaire_answers_user_id_key UNIQUE (user_id);
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'nutrition_plans_user_id_key'
        ) THEN
          ALTER TABLE nutrition_plans ADD CONSTRAINT nutrition_plans_user_id_key UNIQUE (user_id);
        END IF;
      END $$;
    `);
  } catch (e) {/* silenciar en desarrollo */ }
})();

module.exports = router;
