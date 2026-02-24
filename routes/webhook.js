const express = require('express');
const router = express.Router();
const db = require('../db/db');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');

// ─── POST /api/webhook/stripe ────────────────────────────────
// Stripe requiere el body en raw (Buffer), no parseado como JSON
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];

    let event;
    try {
        event = stripeService.constructWebhookEvent(req.body, signature);
    } catch (err) {
        console.error('❌ Webhook signature inválida:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`📣 Stripe webhook recibido: ${event.type}`);

    try {
        switch (event.type) {
            // ─── Pago confirmado ───────────────────────────────────
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                const customerId = invoice.customer;

                const userResult = await db.query(
                    'SELECT id, name, email FROM users WHERE stripe_customer_id = $1',
                    [customerId]
                );
                if (userResult.rows.length === 0) break;
                const user = userResult.rows[0];

                // Registrar pago
                await db.query(`
          INSERT INTO payment_history
            (user_id, stripe_invoice_id, amount_eur, status, billing_period_start, billing_period_end, paid_at)
          VALUES ($1,$2,$3,'paid',$4,$5,NOW())
        `, [
                    user.id,
                    invoice.id,
                    invoice.amount_paid / 100,
                    new Date(invoice.period_start * 1000),
                    new Date(invoice.period_end * 1000),
                ]);

                // Actualizar suscripción a activa
                const nextBilling = new Date(invoice.period_end * 1000);
                await db.query(`
          UPDATE subscriptions
          SET status = 'active', next_billing_date = $1
          WHERE user_id = $2
        `, [nextBilling, user.id]);

                // Email confirmación de pago
                await emailService.sendPaymentConfirmedEmail(user, invoice.amount_paid / 100, nextBilling);
                break;
            }

            // ─── Pago fallido ──────────────────────────────────────
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const customerId = invoice.customer;

                const userResult = await db.query(
                    'SELECT id FROM users WHERE stripe_customer_id = $1',
                    [customerId]
                );
                if (userResult.rows.length === 0) break;

                await db.query(
                    `UPDATE subscriptions SET status = 'past_due' WHERE user_id = $1`,
                    [userResult.rows[0].id]
                );

                await db.query(`
          INSERT INTO payment_history
            (user_id, stripe_invoice_id, amount_eur, status, paid_at)
          VALUES ($1,$2,$3,'failed',NOW())
        `, [userResult.rows[0].id, invoice.id, invoice.amount_due / 100]);
                break;
            }

            // ─── Suscripción cancelada desde Stripe ───────────────
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const customerId = subscription.customer;

                await db.query(`
          UPDATE subscriptions
          SET status = 'cancelled', cancelled_at = NOW()
          WHERE stripe_customer_id = $1 AND status != 'cancelled'
        `, [customerId]);
                break;
            }

            // ─── Trial terminando (notificación de Stripe) ─────────
            case 'customer.subscription.trial_will_end': {
                // Manejado por nuestros cron jobs, pero registramos el evento
                console.log('ℹ️  Trial ending soon para customer:', event.data.object.customer);
                break;
            }

            default:
                console.log(`ℹ️  Evento no manejado: ${event.type}`);
        }
    } catch (err) {
        console.error('❌ Error procesando webhook:', err);
        // Respondemos 200 igualmente para que Stripe no reintente
    }

    res.json({ received: true });
});

module.exports = router;
