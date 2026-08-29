const express = require('express');
const router = express.Router();
const db = require('../db/db');
const authMiddleware = require('../middleware/auth');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');
const { generateAndSavePlan } = require('../services/planGenerationService');

// Precio mensual del plan Pro (configurable por entorno)
const PLAN_PRICE_EUR = parseFloat(process.env.PLAN_PRICE_EUR || '14');

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
// Activa Pro con cobro inmediato después de guardar el método de pago
// (sin prueba gratuita: se cobran PLAN_PRICE_EUR €/mes desde el momento de activar).
router.post('/start', authMiddleware, async (req, res) => {
    // Web: payment_method_id (de confirmCardSetup). Móvil: setup_intent_id
    // (PaymentSheet no expone el payment method; se recupera del SetupIntent).
    const { payment_method_id, setup_intent_id } = req.body;
    if (!payment_method_id && !setup_intent_id) {
        return res.status(400).json({ error: 'Método de pago requerido' });
    }

    // Resolver el payment method (web → directo; móvil → desde el SetupIntent)
    let resolvedPaymentMethodId = payment_method_id;
    if (!resolvedPaymentMethodId && setup_intent_id) {
        try {
            const setupIntent = await stripeService.retrieveSetupIntent(setup_intent_id);
            resolvedPaymentMethodId = setupIntent.payment_method;
        } catch (err) {
            console.error('Error recuperando SetupIntent:', err);
            return res.status(400).json({ error: 'SetupIntent inválido o no encontrado' });
        }
        if (!resolvedPaymentMethodId) {
            return res.status(400).json({ error: 'El SetupIntent no tiene método de pago asociado' });
        }
    }

    try {
        const userId = req.user.id;

        // Verificar si ya tiene suscripción (se permite re-suscribirse tras cancelar/expiar)
        const existingSub = await db.query(
            'SELECT id, status, stripe_subscription_id FROM subscriptions WHERE user_id = $1',
            [userId]
        );
        if (existingSub.rows.length > 0) {
            const prev = existingSub.rows[0];
            const prevStatus = prev.status;
            if (prevStatus !== 'cancelled' && prevStatus !== 'expired') {
                return res.status(409).json({ error: 'Ya tienes una suscripción activa' });
            }
            // Si la anterior era real en Stripe (cancelada a fin de período), cancelarla ya
            // para que no siga cobrando mientras la nueva está en prueba → evita doble cobro.
            if (prev.stripe_subscription_id && !prev.stripe_subscription_id.startsWith('sub_mock_')) {
                await stripeService.cancelSubscription(prev.stripe_subscription_id, false);
            }
            // Limpiar la suscripción anterior para poder crear una nueva (UNIQUE user_id)
            await db.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
        }

        const userResult = await db.query(
            'SELECT id, name, email, stripe_customer_id FROM users WHERE id = $1',
            [userId]
        );
        const user = userResult.rows[0];

        // Vincular método de pago al cliente
        await stripeService.attachPaymentMethod(user.stripe_customer_id, resolvedPaymentMethodId);

        // Cobro inmediato: sin prueba gratuita. Stripe cobra la primera
        // factura de PLAN_PRICE_EUR € al crear la suscripción.
        const startedAt = new Date();
        const nextBilling = new Date(startedAt);
        nextBilling.setMonth(nextBilling.getMonth() + 1); // Próximo cobro: +1 mes

        const chargeDay = startedAt.getDate(); // Mismo día del mes

        // Crear suscripción en Stripe (cobro inmediato, sin trial)
        const stripeSubscription = await stripeService.createSubscription(
            user.stripe_customer_id
        );

        // Guardar suscripción en DB como activa desde el primer momento
        await db.query(`
      INSERT INTO subscriptions
        (user_id, stripe_customer_id, stripe_subscription_id, stripe_payment_method_id,
         trial_start, trial_end, cancel_window_end, charge_day, next_billing_date, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
    `, [userId, user.stripe_customer_id, stripeSubscription.id, resolvedPaymentMethodId,
            startedAt, nextBilling, nextBilling, chargeDay, nextBilling]);

        // Email de bienvenida (Pro activo, sin mención de prueba)
        await emailService.sendWelcomeEmail(user, nextBilling);

        // Regenerar el plan ahora como Pro: si el usuario tenía un plan FREE
        // (guardado sin IA ni suplementos), al activar Pro se recalcula con la
        // mejora IA y la suplementación. Se espera para que la página recargada
        // ya muestre el plan completo; si falla, no bloquea la activación.
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
