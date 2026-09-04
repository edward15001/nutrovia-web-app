// ─── Vytal — routes/foodLog.js ─────────────────────────────
// Diario alimentario de la app móvil: analizar una foto con IA de visión,
// registrar comidas y consultar el resumen del día (restante + streak).

const express = require('express');
const router = express.Router();
const db = require('../db/db');
const authMiddleware = require('../middleware/auth');
const aiVisionService = require('../services/aiVisionService');

// ─── POST /api/foodlog/analyze ───────────────────────────────
// Body: { image: "data:image/jpeg;base64,..." }
// Analiza la foto con el modelo de visión y devuelve los alimentos detectados
// con kcal/macros y si cuadra con el plan. NO guarda (el cliente confirma).
router.post('/analyze', authMiddleware, async (req, res) => {
  const { image } = req.body || {};
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Imagen inválida' });
  }

  // Límite de tamaño (~6MB base64) para no abusar del payload
  if (image.length > 8_500_000) {
    return res.status(400).json({ error: 'Imagen demasiado grande' });
  }

  try {
    const analysis = await aiVisionService.analyzeFoodImage(image);
    if (!analysis) {
      return res.status(422).json({
        error: 'No se pudo analizar la imagen. Prueba con una foto más nítida.',
      });
    }

    // Plan del usuario para comparar
    const planResult = await db.query(
      'SELECT daily_calories FROM nutrition_plans WHERE user_id = $1',
      [req.user.id]
    );
    const plan = planResult.rows[0] || null;

    const { matches_plan, feedback } = aiVisionService.compareWithPlan(
      analysis.total.calories,
      plan
    );

    const meal_type = inferMealType(new Date());

    res.json({
      items: analysis.items,
      total: analysis.total,
      overview: analysis.overview,
      safety_warning: analysis.safety_warning,
      matches_plan,
      feedback,
      meal_type,
    });
  } catch (err) {
    console.error('Error analizando alimento:', err);
    res.status(500).json({ error: 'Error analizando la imagen' });
  }
});

// ─── POST /api/foodlog ───────────────────────────────────────
// Body: { name, calories, protein_g, carbs_g, fat_g, meal_type?, source?, matches_plan?, feedback? }
// Guarda una comida registrada (confirmada por el usuario) y devuelve el
// resumen actualizado del día + streak.
router.post('/', authMiddleware, async (req, res) => {
  const {
    name, calories, protein_g, carbs_g, fat_g,
    meal_type, source = 'camera', matches_plan, feedback,
  } = req.body || {};

  if (typeof calories !== 'number' || isNaN(calories) || calories < 0) {
    return res.status(400).json({ error: 'Calorías inválidas' });
  }

  try {
    const result = await db.query(
      `INSERT INTO food_log
        (user_id, meal_date, meal_type, name, calories, protein_g, carbs_g, fat_g, source, matches_plan, feedback)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [req.user.id, meal_type || null, name || 'Comida', calories,
        protein_g || 0, carbs_g || 0, fat_g || 0, source || 'camera',
        matches_plan || null, feedback || null]
    );

    const summary = await getTodaySummary(req.user.id);
    res.json({ entry: result.rows[0], ...summary });
  } catch (err) {
    console.error('Error guardando alimento:', err);
    res.status(500).json({ error: 'Error guardando el alimento' });
  }
});

// ─── GET /api/foodlog/today ──────────────────────────────────
// Resumen del día: comidas registradas, total consumido, restante vs plan,
// racha (streak) de días consecutivos con registro.
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const summary = await getTodaySummary(req.user.id);
    res.json(summary);
  } catch (err) {
    console.error('Error obteniendo resumen del día:', err);
    res.status(500).json({ error: 'Error obteniendo el resumen' });
  }
});

// ─── DELETE /api/foodlog/:id ─────────────────────────────────
// Elimina una comida mal registrada del diario.
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM food_log WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }
    const summary = await getTodaySummary(req.user.id);
    res.json({ ok: true, ...summary });
  } catch (err) {
    console.error('Error eliminando alimento:', err);
    res.status(500).json({ error: 'Error eliminando el alimento' });
  }
});

// ─── Helpers ─────────────────────────────────────────────────
// Estima qué comida del plan corresponde según la hora actual.
function inferMealType(date) {
  const h = date.getHours();
  if (h >= 6 && h < 11) return 'desayuno';
  if (h >= 11 && h < 14) return 'almuerzo';
  if (h >= 14 && h < 17) return 'comida';
  if (h >= 17 && h < 21) return 'merienda';
  return 'cena';
}

// Calcula el resumen del día y la racha de días consecutivos con registro.
async function getTodaySummary(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entriesResult = await db.query(
    `SELECT id, meal_type, name, calories, protein_g, carbs_g, fat_g,
            source, matches_plan, feedback, created_at
     FROM food_log
     WHERE user_id = $1 AND meal_date = CURRENT_DATE
     ORDER BY created_at DESC`,
    [userId]
  );

  const total = entriesResult.rows.reduce(
    (acc, e) => ({
      calories: acc.calories + Number(e.calories || 0),
      protein_g: acc.protein_g + Number(e.protein_g || 0),
      carbs_g: acc.carbs_g + Number(e.carbs_g || 0),
      fat_g: acc.fat_g + Number(e.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const planResult = await db.query(
    'SELECT daily_calories, protein_g, carbs_g, fat_g FROM nutrition_plans WHERE user_id = $1',
    [userId]
  );
  const plan = planResult.rows[0] || null;

  const remaining = plan ? {
    calories: Math.max(0, Math.round(plan.daily_calories - total.calories)),
    protein_g: Math.max(0, Math.round(plan.protein_g - total.protein_g)),
    carbs_g: Math.max(0, Math.round(plan.carbs_g - total.carbs_g)),
    fat_g: Math.max(0, Math.round(plan.fat_g - total.fat_g)),
  } : null;

  const exceeded = plan ? {
    calories: total.calories > plan.daily_calories,
    protein_g: total.protein_g > plan.protein_g,
    carbs_g: total.carbs_g > plan.carbs_g,
    fat_g: total.fat_g > plan.fat_g,
  } : null;

  const streak = await computeStreak(userId);

  return {
    date: today.toISOString().slice(0, 10),
    entries: entriesResult.rows.map(e => ({
      ...e,
      calories: Number(e.calories),
      protein_g: Number(e.protein_g),
      carbs_g: Number(e.carbs_g),
      fat_g: Number(e.fat_g),
    })),
    total,
    plan,
    remaining,
    exceeded,
    streak,
    // «Objetivo cumplido» cuando se alcanza al menos la proteína y las kcal del día
    goal_met: plan ? (total.calories >= plan.daily_calories || total.protein_g >= plan.protein_g) : false,
  };
}

// Racha de días consecutivos (terminando hoy o ayer) con al menos una comida.
async function computeStreak(userId) {
  const result = await db.query(
    `SELECT DISTINCT meal_date FROM food_log
     WHERE user_id = $1
     ORDER BY meal_date DESC
     LIMIT 400`,
    [userId]
  );
  const dates = result.rows.map(r => {
    const d = new Date(r.meal_date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const set = new Set(dates);
  if (set.size === 0) return 0;

  // Empezar desde hoy; si hoy no hay, permitimos partir de ayer (la racha
  // no se pierde hasta pasada la medianoche).
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let cursor = new Date(now);
  if (!set.has(cursor.getTime())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(cursor.getTime())) return 0;
  }

  let streak = 1;
  const DAY_MS = 24 * 60 * 60 * 1000;
  while (true) {
    const prev = cursor.getTime() - DAY_MS;
    if (set.has(prev)) {
      streak++;
      cursor = new Date(prev);
    } else {
      break;
    }
  }
  return streak;
}

module.exports = router;