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

    // ─── Cron semanal (lunes 09:00): check-in de progreso ─────
    // (Ya no hay cron de trial: el cobro de Pro es inmediato y Stripe
    // gestiona el ciclo de cobros; los webhooks actualizan la BD.)
    cron.schedule('0 9 * * 1', async () => {
        console.log(`\n[${new Date().toISOString()}] 🌱 Ejecutando check-ins semanales...`);
        await checkWeeklyCheckins();
    }, { timezone: 'Europe/Madrid' });

    console.log('✅ Cron jobs registrados (check-in lunes 09:00 Madrid)');
}

/**
 * Check-in semanal: envía "¿Cómo va ese progreso?" a usuarios que llevan
 * más de 7 días sin actualizar sus valores ni responder al check-in,
 * y que no han recibido ya un email de check-in esta semana.
 */
async function checkWeeklyCheckins() {
    try {
        const result = await db.query(`
      SELECT u.id, u.name, u.email
      FROM users u
      JOIN questionnaire_answers qa ON qa.user_id = u.id
      WHERE (u.last_checkin_email_at IS NULL OR u.last_checkin_email_at < NOW() - INTERVAL '7 days')
        AND NOW() - GREATEST(COALESCE(qa.updated_at, qa.created_at), COALESCE(u.last_checkin_at, '1970-01-01')) >= INTERVAL '7 days'
    `);

        console.log(`🌱 Check-ins semanales pendientes: ${result.rows.length}`);

        for (const user of result.rows) {
            const sent = await emailService.sendCheckinEmail({ name: user.name, email: user.email });
            if (sent) {
                await db.query(
                    'UPDATE users SET last_checkin_email_at = NOW() WHERE id = $1',
                    [user.id]
                );
            }
        }
    } catch (err) {
        console.error('❌ Error en checkWeeklyCheckins:', err.message);
    }
}

module.exports = { initCronJobs };
