const express = require('express');
const router = express.Router();
const db = require('../db/db');
const authMiddleware = require('../middleware/auth');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');

// ─── POST /api/subscription/setup-intent ────────────────────
// Crea un SetupIntent de Stripe (el frontend captura la tarjeta sin cobrar)
router.post('/setup-intent', authMiddleware, async (req, res) => {
    try {
        const userResult = await db.query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.user.id]);
        const customer = userResult.rows[0];
        if (!customer) return res.status(404).json({ error: 'Usuario no encontrado' });

        const setupIntent = await stripeService.createSetupIntent(customer.stripe_customer_id);
        res.json({
            client_secret: setupIntent.client_secret,
            publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
        });
    } catch (err) {
        console.error('Error creando SetupIntent:', err);
        res.status(500).json({ error: 'Error al configurar el pago' });
    }
});

// ─── POST /api/subscription/start ───────────────────────────
// Activa la prueba gratuita después de guardar el método de pago
router.post('/start', authMiddleware, async (req, res) => {
    const { payment_method_id } = req.body;
    if (!payment_method_id) {
        return res.status(400).json({ error: 'Método de pago requerido' });
    }

    try {
        const userId = req.user.id;

        // Verificar si ya tiene suscripción
        const existingSub = await db.query('SELECT id FROM subscriptions WHERE user_id = $1', [userId]);
        if (existingSub.rows.length > 0) {
            return res.status(409).json({ error: 'Ya tienes una suscripción activa' });
        }

        const userResult = await db.query(
            'SELECT id, name, email, stripe_customer_id FROM users WHERE id = $1',
            [userId]
        );
        const user = userResult.rows[0];

        // Vincular método de pago al cliente
        await stripeService.attachPaymentMethod(user.stripe_customer_id, payment_method_id);

        // Calcular fechas
        const trialStart = new Date();
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + 30);

        const cancelWindowEnd = new Date(trialEnd);
        cancelWindowEnd.setDate(cancelWindowEnd.getDate() + 15); // Día 45

        const chargeDay = trialStart.getDate(); // Mismo día del mes

        // Crear suscripción en Stripe con trial hasta día 45
        const stripeSubscription = await stripeService.createSubscription(
            user.stripe_customer_id,
            Math.floor(cancelWindowEnd.getTime() / 1000) // Unix timestamp día 45
        );

        // Guardar suscripción en DB
        await db.query(`
      INSERT INTO subscriptions
        (user_id, stripe_customer_id, stripe_subscription_id, stripe_payment_method_id,
         trial_start, trial_end, cancel_window_end, charge_day, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'trial')
    `, [userId, user.stripe_customer_id, stripeSubscription.id, payment_method_id,
            trialStart, trialEnd, cancelWindowEnd, chargeDay]);

        // Email de bienvenida
        await emailService.sendWelcomeEmail(user, trialEnd);

        res.json({
            message: '¡Prueba gratuita iniciada!',
            trial_start: trialStart,
            trial_end: trialEnd,
            cancel_window_end: cancelWindowEnd,
            charge_day: chargeDay,
            status: 'trial',
        });

    } catch (err) {
        console.error('Error iniciando suscripción:', err);
        res.status(500).json({ error: 'Error al iniciar la prueba gratuita' });
    }
});

// ─── GET /api/subscription/status ───────────────────────────
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, status, trial_start, trial_end, cancel_window_end,
              charge_day, next_billing_date, cancelled_at
       FROM subscriptions WHERE user_id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.json({ status: 'none', message: 'Sin suscripción activa' });
        }

        const sub = result.rows[0];
        const now = new Date();
        let daysRemaining = null;

        if (sub.status === 'trial') {
            const trialEnd = new Date(sub.trial_end);
            if (now <= trialEnd) {
                daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                sub.phase = 'prueba_gratuita';
                sub.days_remaining_trial = daysRemaining;
            } else {
                const cancelEnd = new Date(sub.cancel_window_end);
                const daysToCancelEnd = Math.ceil((cancelEnd - now) / (1000 * 60 * 60 * 24));
                sub.phase = 'ventana_cancelacion';
                sub.days_to_charge = Math.max(0, daysToCancelEnd);
            }
        }

        res.json(sub);
    } catch (err) {
        console.error('Error en estado de suscripción:', err);
        res.status(500).json({ error: 'Error obteniendo estado' });
    }
});

// ─── POST /api/subscription/cancel ──────────────────────────
router.post('/cancel', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const subResult = await db.query(
            'SELECT * FROM subscriptions WHERE user_id = $1', [userId]
        );
        if (subResult.rows.length === 0) {
            return res.status(404).json({ error: 'No tienes ninguna suscripción activa' });
        }

        const sub = subResult.rows[0];
        if (sub.status === 'cancelled') {
            return res.status(409).json({ error: 'Tu suscripción ya está cancelada' });
        }

        // Cancelar en Stripe
        if (sub.stripe_subscription_id) {
            await stripeService.cancelSubscription(sub.stripe_subscription_id, sub.status === 'active');
        }

        // Determinar fecha efectiva de cancelación
        const now = new Date();
        let effectiveDate;
        if (sub.status === 'trial') {
            effectiveDate = now; // Cancelación inmediata en trial
        } else {
            // Si ya está activa, cancela al final del período
            const nextBilling = new Date(sub.next_billing_date);
            effectiveDate = nextBilling;
        }

        await db.query(
            `UPDATE subscriptions
       SET status = 'cancelled', cancelled_at = NOW()
       WHERE user_id = $1`,
            [userId]
        );

        // Obtener datos del usuario para el email
        const userResult = await db.query('SELECT name, email FROM users WHERE id = $1', [userId]);
        await emailService.sendCancellationEmail(userResult.rows[0], effectiveDate);

        res.json({
            message: 'Suscripción cancelada correctamente',
            effective_date: effectiveDate,
        });

    } catch (err) {
        console.error('Error cancelando suscripción:', err);
        res.status(500).json({ error: 'Error al cancelar la suscripción' });
    }
});

module.exports = router;
