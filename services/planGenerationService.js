// ─── Vytal — services/planGenerationService.js ─────────────
// Genera, mejora (IA opcional) y persiste el plan personalizado de un
// usuario. Se reutiliza tanto en /api/questionnaire (creación/actualización)
// como tras el upgrade a Pro, para que el plan guardado cuando el usuario era
// FREE se regenere con IA y suplementación al pasar a Pro.

const db = require('../db/db');
const { generatePersonalizedPlan } = require('../controllers/planEngine');
const aiPlanService = require('../services/aiPlanService');

/**
 * Genera y guarda el plan del usuario (upsert).
 * @param {number} userId
 * @param {object} answers  Perfil normalizado del cuestionario.
 * @param {object} opts
 * @param {boolean} opts.isPro  Si es Pro, aplica IA y conserva suplementos.
 * @returns {Promise<object>} El plan completo (motor ± IA).
 */
async function generateAndSavePlan(userId, answers, { isPro = false } = {}) {
  let plan = generatePersonalizedPlan(answers);

  // Mejora con IA (opcional y SOLO para Pro). Si falla o tarda, se queda
  // el plan del motor determinista.
  if (isPro && aiPlanService.isConfigured()) {
    const aiPlan = await aiPlanService.generatePersonalizedPlanWithAI(answers, {
      daily_calories: plan.daily_calories,
      protein_g: plan.protein_g,
      carbs_g: plan.carbs_g,
      fat_g: plan.fat_g,
    });

    if (aiPlan) {
      if (aiPlan.weekly_menu) plan.weekly_menu = aiPlan.weekly_menu;
      // El training_plan de la IA solo se adopta si respeta el número de días
      // de entrenamiento del usuario (el motor genera exactamente los pedidos).
      const requestedDays = Number(answers.training_days_per_week) || 3;
      if (aiPlan.training_plan && Array.isArray(aiPlan.training_plan.sesiones) &&
          aiPlan.training_plan.sesiones.length === requestedDays) {
        plan.training_plan = aiPlan.training_plan;
      }
      if (Array.isArray(aiPlan.supplements) && aiPlan.supplements.length > 0) {
        plan.supplements = aiPlan.supplements;
      }
      // Notas de salud y consejos: se conservan los del motor (avisos de
      // seguridad) y se añaden los de la IA sin duplicar.
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

  // La suplementación es exclusiva de Pro: el free no guarda suplementos.
  if (!isPro) {
    plan.supplements = [];
  }

  // Persistir (upsert)
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

  return plan;
}

module.exports = { generateAndSavePlan };