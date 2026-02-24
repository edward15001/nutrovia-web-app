const express = require('express');
const router = express.Router();
const db = require('../db/db');
const authMiddleware = require('../middleware/auth');

// ─── GET /api/plan ───────────────────────────────────────────
// Retorna el plan personalizado del usuario autenticado
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT np.*, qa.goal, qa.activity_level, qa.dietary_preference,
              qa.age, qa.sex, qa.weight_kg, qa.height_cm, qa.health_conditions
       FROM nutrition_plans np
       JOIN questionnaire_answers qa ON qa.user_id = np.user_id
       WHERE np.user_id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'No tienes un plan generado aún',
                code: 'NO_PLAN',
            });
        }

        const row = result.rows[0];
        res.json({
            daily_calories: row.daily_calories,
            protein_g: row.protein_g,
            carbs_g: row.carbs_g,
            fat_g: row.fat_g,
            weekly_menu: row.weekly_menu,
            training_plan: row.training_plan,
            supplements: row.supplements,
            profile: {
                goal: row.goal,
                activity_level: row.activity_level,
                dietary_preference: row.dietary_preference,
                sex: row.sex,
                age: row.age,
                weight_kg: row.weight_kg,
                height_cm: row.height_cm,
                health_conditions: row.health_conditions,
            },
            generated_at: row.generated_at,
        });

    } catch (err) {
        console.error('Error obteniendo plan:', err);
        res.status(500).json({ error: 'Error al obtener el plan' });
    }
});

module.exports = router;
