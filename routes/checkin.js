const express = require('express');
const router = express.Router();
const db = require('../db/db');
const authMiddleware = require('../middleware/auth');

// Días sin actividad (registrar valores o responder al check-in) antes de preguntar
const CHECKIN_INTERVAL_DAYS = parseInt(process.env.CHECKIN_INTERVAL_DAYS || '7', 10);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calcula si el usuario tiene pendiente el check-in semanal de progreso.
 * Se considera "actividad" actualizar los valores del cuestionario o
 * responder al check-in anterior.
 */
async function getCheckinState(userId) {
    const result = await db.query(`
        SELECT qa.updated_at, qa.created_at, u.last_checkin_at
        FROM questionnaire_answers qa
        JOIN users u ON u.id = qa.user_id
        WHERE qa.user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
        return { has_plan: false, due: false };
    }

    const row = result.rows[0];
    const lastActivityMs = Math.max(
        row.updated_at ? new Date(row.updated_at).getTime() : 0,
        row.created_at ? new Date(row.created_at).getTime() : 0,
        row.last_checkin_at ? new Date(row.last_checkin_at).getTime() : 0
    );

    const daysSince = Math.floor((Date.now() - lastActivityMs) / MS_PER_DAY);
    return {
        has_plan: true,
        due: daysSince >= CHECKIN_INTERVAL_DAYS,
        days_since_last_activity: Math.max(0, daysSince),
        checkin_interval_days: CHECKIN_INTERVAL_DAYS,
    };
}

// ─── GET /api/checkin/status ────────────────────────────────
// Devuelve si toca preguntar "¿Cómo va ese progreso?"
router.get('/status', authMiddleware, async (req, res) => {
    try {
        res.json(await getCheckinState(req.user.id));
    } catch (err) {
        console.error('Error en checkin/status:', err);
        res.status(500).json({ error: 'Error obteniendo estado del check-in' });
    }
});

// ─── POST /api/checkin/respond ──────────────────────────────
// Registra la respuesta del usuario al check-in semanal
//  - all_good:    todo va bien → no se vuelve a preguntar durante 7 días
//  - want_change: quiere actualizar sus valores → se le lleva al cuestionario
router.post('/respond', authMiddleware, async (req, res) => {
    const { response } = req.body;
    if (!['all_good', 'want_change'].includes(response)) {
        return res.status(400).json({ error: 'Respuesta de check-in inválida' });
    }

    try {
        await db.query(
            'UPDATE users SET last_checkin_at = NOW() WHERE id = $1',
            [req.user.id]
        );
        res.json({
            message: 'Check-in registrado',
            response,
            next_checkin_after_days: CHECKIN_INTERVAL_DAYS,
        });
    } catch (err) {
        console.error('Error en checkin/respond:', err);
        res.status(500).json({ error: 'Error registrando el check-in' });
    }
});

module.exports = router;
