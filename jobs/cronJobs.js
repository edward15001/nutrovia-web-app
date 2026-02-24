const cron = require('node-cron');
const db = require('../db/db');
const emailService = require('../services/emailService');

/**
 * Cron Jobs de NutroVia
 * Se ejecutan diariamente a las 08:00 para gestionar el ciclo de vida
 * de las suscripciones y enviar notificaciones.
 */
function initCronJobs() {
    console.log('⏰ Iniciando cron jobs de NutroVia...');

    // ─── Cron diario a las 08:00 ────────────────────────────
    cron.schedule('0 8 * * *', async () => {
        console.log(`\n[${new Date().toISOString()}] 🔄 Ejecutando cron jobs diarios...`);
        await checkTrialEnding();
        await checkChargeWarning();
        await activateExpiredTrials();
    }, { timezone: 'Europe/Madrid' });

    console.log('✅ Cron jobs registrados (diario 08:00 Madrid)');
}

/**
 * Día 30: Envía aviso de fin de prueba a usuarios cuyo trial termina hoy
 */
async function checkTrialEnding() {
    try {
        const result = await db.query(`
      SELECT s.id, s.user_id, s.trial_end, s.cancel_window_end, u.name, u.email
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'trial'
        AND s.trial_end_notified = FALSE
        AND DATE(s.trial_end) <= CURRENT_DATE
    `);

        console.log(`📬 Subscripciones con trial terminado: ${result.rows.length}`);

        for (const sub of result.rows) {
            await emailService.sendTrialEndingEmail(
                { name: sub.name, email: sub.email },
                sub.cancel_window_end
            );
            await db.query(
                'UPDATE subscriptions SET trial_end_notified = TRUE WHERE id = $1',
                [sub.id]
            );
        }
    } catch (err) {
        console.error('❌ Error en checkTrialEnding:', err.message);
    }
}

/**
 * Día 44: Envía aviso de cobro inminente (mañana día 45)
 */
async function checkChargeWarning() {
    try {
        const result = await db.query(`
      SELECT s.id, s.user_id, s.cancel_window_end, u.name, u.email
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'trial'
        AND s.charge_warning_notified = FALSE
        AND DATE(s.cancel_window_end) = CURRENT_DATE + INTERVAL '1 day'
    `);

        console.log(`⚠️  Avisos de cobro inmediato: ${result.rows.length}`);

        for (const sub of result.rows) {
            await emailService.sendChargeWarningEmail(
                { name: sub.name, email: sub.email },
                sub.cancel_window_end
            );
            await db.query(
                'UPDATE subscriptions SET charge_warning_notified = TRUE WHERE id = $1',
                [sub.id]
            );
        }
    } catch (err) {
        console.error('❌ Error en checkChargeWarning:', err.message);
    }
}

/**
 * Día 45+: Activa suscripciones cuyo período de gracia expiró y
 * que no han sido canceladas — Stripe cobra automáticamente.
 */
async function activateExpiredTrials() {
    try {
        const result = await db.query(`
      SELECT s.id, s.user_id, u.name, u.email
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'trial'
        AND s.cancel_window_end <= NOW()
    `);

        console.log(`💳 Suscripciones a activar: ${result.rows.length}`);

        for (const sub of result.rows) {
            await db.query(
                `UPDATE subscriptions
         SET status = 'active',
             next_billing_date = cancel_window_end + INTERVAL '1 month'
         WHERE id = $1`,
                [sub.id]
            );
            console.log(`✅ Suscripción activada para usuario ${sub.email}`);
        }
    } catch (err) {
        console.error('❌ Error en activateExpiredTrials:', err.message);
    }
}

module.exports = { initCronJobs };
