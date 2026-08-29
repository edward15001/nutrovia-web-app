const express = require('express');
const router = express.Router();
const db = require('../db/db');
const authMiddleware = require('../middleware/auth');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');
const { generateAndSavePlan } = require('../services/planGenerationService');

// Precio mensual del plan Pro (configurable por entorno)
const PLAN_PRICE_EUR = parseFloat(process.env.PLAN_PRICE_EUR || '14');

// ─── POST /api/subscription/intent ──────────────────────────
// Crea la suscripción Pro (cobro inmediato) y devuelve el client_secret del
// PaymentIntent de la primera factura. El cliente lo presenta en un
// PaymentSheet (móvil) o confirmCardPayment (web): al confirmarlo se cobran
// los PLAN_PRICE_EUR € y la suscripción queda activa en Stripe.
router.post('/intent', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const userResult = await db.query(
            'SELECT id, name, email, stripe_customer_id FROM users WHERE id = $1', [userId]
        );
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Guard: no duplicar si ya hay una suscripción abierta en la BD
        const existing = await db.query(
            'SELECT id, status, stripe_subscription_id FROM subscriptions WHERE user_id = $1',
            [userId]
        );
        if (existing.rows.length > 0) {
            const prev = existing.rows[0];
            if (prev.status !== 'cancelled' && prev.status !== 'expired') {
                return res.status(409).json({ error: 'Ya tienes una suscripción activa' });
            }
            // Si la anterior era real en Stripe (cancelada a fin de período),
            // cancelarla ya para que no siga cobrando mientras se activa la nueva.
            if (prev.stripe_subscription_id && !prev.stripe_subscription_id.startsWith('sub_mock_')) {
                await stripeService.cancelSubscription(prev.stripe_subscription_id, false);
            }
            await db.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
        }

        // Robustez: si en Stripe ya existe una suscripción abierta/pagada para
        // el cliente (p. ej. reintento tras un /start fallido), no crear otra.
        const open = await stripeService.findOpenSubscription(user.stripe_customer_id);
        if (open) {
            return res.json({
                already_active: true,
                subscription_id: open.id,
                client_secret: null,
                publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
            });
        }

        const subscription = await stripeService.createSubscription(user.stripe_customer_id);
        const pi = subscription.latest_invoice && subscription.latest_invoice.payment_intent;
        if (!pi || !pi.client_secret) {
            return res.status(500).json({ error: 'No se pudo preparar el cobro' });
        }

        res.json({
            client_secret: pi.client_secret,
            publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
            subscription_id: subscription.id,
        });
    } catch (err) {
        console.error('Error creando intent de suscripción:', err);
        res.status(500).json({ error: 'Error al preparar el pago' });
    }
});

// ─── POST /api/subscription/start ───────────────────────────
// Finaliza la activación de Pro tras un pago confirmado (cobro inmediato).
// El cliente envía el subscription_id devuelto por /intent; aquí se registra
// la suscripción como activa en la BD, se envía el email y se regenera el plan.
router.post('/start', authMiddleware, async (req, res) => {
    const { subscription_id } = req.body;
    if (!subscription_id) {
        return res.status(400).json({ error: 'Falta el identificador de suscripción' });
    }

    try {
        const userId = req.user.id;
        const userResult = await db.query(
            'SELECT id, name, email, stripe_customer_id FROM users WHERE id = $1', [userId]
        );
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Idempotente: si ya quedó una sub abierta para este usuario, no duplicar.
        const existing = await db.query(
            `SELECT id, status FROM subscriptions
             WHERE user_id = $1 AND status IN ('trial','active','past_due')`, [userId]
        );
        if (existing.rows.length > 0) {
            return res.json({
                message: '¡Plan Pro activado!',
                status: existing.rows[0].status,
                already_active: true,
            });
        }

        // Confirmar que el cobro se completó en Stripe antes de marcar activo.
        const sub = await stripeService.retrieveSubscription(subscription_id);
        if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') {
            return res.status(400).json({ error: 'El pago no se ha completado. Inténtalo de nuevo.' });
        }

        const defaultPm =
            sub.default_payment_method ||
            (sub.latest_invoice && sub.latest_invoice.payment_intent &&
                sub.latest_invoice.payment_intent.payment_method) ||
            null;

        const startedAt = new Date();
        const nextBilling = new Date(startedAt);
        nextBilling.setMonth(nextBilling.getMonth() + 1); // Próximo cobro: +1 mes
        const chargeDay = startedAt.getDate();

        await db.query(`
      INSERT INTO subscriptions
        (user_id, stripe_customer_id, stripe_subscription_id, stripe_payment_method_id,
         trial_start, trial_end, cancel_window_end, charge_day, next_billing_date, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
    `, [userId, user.stripe_customer_id, sub.id, defaultPm,
            startedAt, nextBilling, nextBilling, chargeDay, nextBilling]);

        await emailService.sendWelcomeEmail(user, nextBilling);

        // Regenerar el plan ahora como Pro (IA + suplementos). No bloquea.
        try {
            await regenerateProPlan(userId);
        } catch (err) {
            console.error('Error regenerando plan tras activar Pro:', err);
        }

        res.json({
            message: '¡Plan Pro activado!',
            plan_price_eur: PLAN_PRICE_EUR,
            next_billing_date: nextBilling,
            charge_day: chargeDay,
            status: 'active',
        });

    } catch (err) {
        console.error('Error activando Pro:', err);
        res.status(500).json({ error: 'Error al activar Pro. Inténtalo de nuevo.' });
    }
});

// Vuelve a generar el plan del usuario con las capacidades de Pro (IA +
// suplementos). Se usa tras activar la suscripción para completar el plan.
async function regenerateProPlan(userId) {
    const answersResult = await db.query(
        `SELECT age, sex, weight_kg, height_cm, target_weight_kg, goal, activity_level,
                dietary_preference, health_conditions, training_experience,
                training_days_per_week, training_equipment
         FROM questionnaire_answers WHERE user_id = $1`,
        [userId]
    );
    if (answersResult.rows.length === 0) return;

    await generateAndSavePlan(userId, answersResult.rows[0], { isPro: true });
}

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

// ─── GET /api/subscription/history ──────────────────────────
// Historial de pagos del usuario (facturas de Stripe registradas por el webhook)
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT stripe_invoice_id, amount_eur, status,
              billing_period_start, billing_period_end, paid_at
       FROM payment_history
       WHERE user_id = $1
       ORDER BY COALESCE(paid_at, created_at) DESC`,
            [req.user.id]
        );
        res.json({ payments: result.rows });
    } catch (err) {
        console.error('Error obteniendo historial de pagos:', err);
        res.status(500).json({ error: 'Error al obtener el historial de pagos' });
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

        // Cancelar en Stripe (si está en prueba, cancelación inmediata sin cargo)
        if (sub.stripe_subscription_id) {
            await stripeService.cancelSubscription(sub.stripe_subscription_id, sub.status === 'active');
        }

        // Determinar fecha efectiva de cancelación
        const now = new Date();
        let effectiveDate;
        if (sub.status === 'trial') {
            effectiveDate = now; // Cancelación inmediata en trial: nunca se cobra
        } else {
            // Si ya está activa, cancela al final del período ya pagado
            effectiveDate = sub.next_billing_date
                ? new Date(sub.next_billing_date)
                : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // fallback: +30 días
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
