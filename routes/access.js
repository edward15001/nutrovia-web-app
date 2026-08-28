const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const accessService = require('../services/accessService');

// ─── GET /api/access ────────────────────────────────────────
// Devuelve el nivel de acceso del usuario (free/pro) y qué funciones
// tiene desbloqueadas, para que el frontend pinte paywalls/CTAs coherentes.
router.get('/', authMiddleware, async (req, res) => {
    try {
        const access = await accessService.getUserAccess(req.user.id);

        res.json({
            tier: access.tier,
            isPro: access.isPro,
            label: access.label,
            regenerationsUsed: access.regenerationsUsed,
            // null = ilimitado
            maxRegenerations: access.maxRegenerations,
            canRegenerate: access.canRegenerate,
            features: {
                ia: access.hasIA,
                supplements: access.hasSupplements,
                checkins: access.hasCheckins,
                mealDetail: access.hasMealDetail,
            },
        });
    } catch (err) {
        console.error('Error en /api/access:', err);
        res.status(500).json({ error: 'Error obteniendo el nivel de acceso' });
    }
});

module.exports = router;