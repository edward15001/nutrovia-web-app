const express = require('express');
const router = express.Router();
const db = require('../db/db');
const authMiddleware = require('../middleware/auth');
const { applySwap } = require('../controllers/planSwap');
const accessService = require('../services/accessService');

// ─── GET /api/plan ───────────────────────────────────────────
// Retorna el plan personalizado del usuario autenticado
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT np.*, qa.goal, qa.activity_level, qa.dietary_preference,
              qa.age, qa.sex, qa.weight_kg, qa.height_cm, qa.target_weight_kg,
              qa.health_conditions, qa.training_experience, qa.training_days_per_week,
              qa.training_equipment
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

        // Nivel de acceso: define qué parte del plan se expone.
        // El free ve macros/calorías y consejos, pero NO el detalle de comidas
        // (modo "a oscuras") ni los suplementos.
        const access = await accessService.getUserAccess(req.user.id);

        let weeklyMenu = row.weekly_menu;
        let supplements = row.supplements;
        if (!access.isPro) {
            // Modo "a oscuras": solo las kcal totales por día, sin comidas
            const dimmed = {};
            const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            for (const d of dayNames) {
                const menu = row.weekly_menu && row.weekly_menu[d];
                if (!menu) continue;
                const kcal = Object.keys(menu).reduce((sum, k) => {
                    const m = menu[k];
                    return sum + (m && m.calorias ? Number(m.calorias) : 0);
                }, 0);
                dimmed[d] = { _kcal: kcal };
            }
            weeklyMenu = dimmed;
            supplements = [];
        }

        res.json({
            access,
            daily_calories: row.daily_calories,
            protein_g: row.protein_g,
            carbs_g: row.carbs_g,
            fat_g: row.fat_g,
            weekly_menu: weeklyMenu,
            training_plan: row.training_plan,
            supplements,
            notas_dieta: row.notas_dieta,
            consejos_generales: row.consejos_generales,
            profile: {
                goal: row.goal,
                activity_level: row.activity_level,
                dietary_preference: row.dietary_preference,
                sex: row.sex,
                age: row.age,
                weight_kg: row.weight_kg,
                height_cm: row.height_cm,
                target_weight_kg: row.target_weight_kg,
                health_conditions: row.health_conditions,
                training_experience: row.training_experience,
                training_days_per_week: row.training_days_per_week,
                training_equipment: row.training_equipment,
            },
            generated_at: row.generated_at,
        });

    } catch (err) {
        console.error('Error obteniendo plan:', err);
        res.status(500).json({ error: 'Error al obtener el plan' });
    }
});

// ─── POST /api/plan/swap ─────────────────────────────────────
// Intercambia una comida de un día por otra (calendario de nutrición).
// body: { day, meal_key, replacement: { nombre, calorias, ingredientes? } }
router.post('/swap', authMiddleware, async (req, res) => {
    try {
        // El intercambio de comidas es exclusivo de Pro: el free "a oscuras"
        // no ve el detalle y por tanto tampoco puede modificarlo.
        const access = await accessService.getUserAccess(req.user.id);
        if (!access.isPro) {
            return res.status(403).json({ error: 'Personalizar comidas es una función de Pro.', code: 'PRO_ONLY' });
        }

        const { day, meal_key, replacement } = req.body || {};
        const result = await db.query(
            'SELECT weekly_menu FROM nutrition_plans WHERE user_id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No tienes un plan generado aún', code: 'NO_PLAN' });
        }

        const applied = applySwap(result.rows[0].weekly_menu || {}, day, meal_key, replacement);
        if (applied.error) {
            return res.status(400).json({ error: applied.error });
        }

        await db.query(
            'UPDATE nutrition_plans SET weekly_menu = $1 WHERE user_id = $2',
            [JSON.stringify(applied.menu), req.user.id]
        );

        res.json({ ok: true, day, meal_key, menu: applied.menu });
    } catch (err) {
        console.error('Error al intercambiar comida:', err);
        res.status(500).json({ error: 'Error al actualizar el plan' });
    }
});

module.exports = router;
