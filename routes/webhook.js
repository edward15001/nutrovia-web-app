const express = require('express');
const router = express.Router();
const db = require('../db/db');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');

// ─── POST /api/webhook/stripe ────────────────────────────────
// Acepta tanto /api/webhook como /api/webhook/stripe (el README y
// `stripe listen --forward-to` usan la segunda).
// Stripe requiere el body en raw (Buffer), no parseado como JSON
router.post(['/', '/stripe'], express.raw({ type: 'application/json' }), async (req, res) => {
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
                const stripeSubscriptionId = invoice.subscription;

                // Ignorar facturas de 0 € (p.ej. la inicial de un trial): no son pagos reales
                if (!invoice.amount_paid || invoice.amount_paid <= 0) break;

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

                // Actualizar la suscripción a activa. Buscamos por stripe_subscription_id
                // (no por user_id) para no tocar una sub nueva con una factura tardía de la anterior.
                const nextBilling = new Date(invoice.period_end * 1000);
                if (stripeSubscriptionId) {
                    await db.query(`
            UPDATE subscriptions
            SET status = 'active', next_billing_date = $1
            WHERE stripe_subscription_id = $2
          `, [nextBilling, stripeSubscriptionId]);
                } else {
                    await db.query(`
            UPDATE subscriptions
            SET status = 'active', next_billing_date = $1
            WHERE user_id = $2
          `, [nextBilling, user.id]);
                }

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
                const subscriptionId = subscription.id;

                // Buscar por stripe_subscription_id (único), NO por customer_id:
                // si el usuario se re-suscribió, hay varias filas con el mismo
                // stripe_customer_id y cancelaríamos la suscripción nueva.
                await db.query(`
          UPDATE subscriptions
          SET status = 'cancelled', cancelled_at = NOW()
          WHERE stripe_subscription_id = $1 AND status != 'cancelled'
        `, [subscriptionId]);
                break;
            }

            // ─── Trial terminando (notificación de Stripe) ─────────
            case 'customer.subscription.trial_will_end': {
                // Stripe avisa ~3 días antes del fin del trial. En producción los
                // cron jobs no corren (solo en local), así que este webhook es el
                // encargado de avisar al usuario por email.
                const sub = event.data.object;
                const userResult = await db.query(
                    'SELECT id, name, email FROM users WHERE stripe_customer_id = $1',
                    [sub.customer]
                );
                if (userResult.rows.length > 0) {
                    const user = userResult.rows[0];
                    const trialEnd = new Date(sub.current_period_end * 1000);
                    await emailService.sendTrialWillEndEmail(user, trialEnd);
                    // Marcar como notificado para que el cron local no duplique
                    await db.query(
                        `UPDATE subscriptions SET trial_end_notified = TRUE
               WHERE user_id = $1`,
                        [user.id]
                    );
                    console.log(`ℹ️  Trial ending soon enviado a ${user.email} (fin: ${trialEnd.toISOString()})`);
                } else {
                    console.log('ℹ️  Trial ending soon para customer desconocido:', sub.customer);
                }
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
