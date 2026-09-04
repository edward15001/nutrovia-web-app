/**
 * Vytal — Tests del servicio de email en modo mock
 * Verifica que sin credenciales SMTP reales el servicio usa el mock
 * y que cada email devuelve true (éxito simulado).
 */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

describe('emailService (modo mock)', () => {
  let emailService;

  beforeEach(() => {
    // Forzar modo mock: placeholder SMTP y sin ADMIN_EMAIL real
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'tu_email@gmail.com';
    process.env.SMTP_PASS = 'placeholder';
    process.env.EMAIL_FROM = 'Vytal <tu_email@gmail.com>';
    process.env.ADMIN_EMAIL = '';
    process.env.APP_URL = 'http://localhost:3000';
    delete process.env.STRIPE_SECRET_KEY;

    // Recargar el módulo para que lea las env vars actuales
    delete require.cache[require.resolve('../services/emailService')];
    emailService = require('../services/emailService');
  });

  test('envía email de bienvenida (Pro activo) en modo mock', async () => {
    const ok = await emailService.sendWelcomeEmail(
      { name: 'Carlos', email: 'carlos@test.com' },
      new Date('2026-09-01')
    );
    assert.strictEqual(ok, true);
  });

  test('envía email del plan nutricional en modo mock', async () => {
    const ok = await emailService.sendNutritionPlanEmail(
      { name: 'Carlos', email: 'carlos@test.com' },
      { daily_calories: 2200, protein_g: 150, carbs_g: 220, fat_g: 70 }
    );
    assert.strictEqual(ok, true);
  });

  test('envía email de pago confirmado', async () => {
    const ok = await emailService.sendPaymentConfirmedEmail(
      { name: 'Ana', email: 'ana@test.com' },
      25,
      new Date('2026-10-01')
    );
    assert.strictEqual(ok, true);
  });

  test('envía email de cancelación (vuelta al plan gratuito)', async () => {
    const ok = await emailService.sendCancellationEmail(
      { name: 'Ana', email: 'ana@test.com' },
      new Date('2026-10-01')
    );
    assert.strictEqual(ok, true);
  });

  test('sin ADMIN_EMAIL no envía aviso de nuevo usuario', async () => {
    const ok = await emailService.sendNewUserNotificationEmail({ name: 'X', email: 'x@test.com' });
    assert.strictEqual(ok, false);
  });

  test('el footer de los emails usa el año actual, no uno hardcodeado', async () => {
    // El wrapper es interno, pero el año actual debe aparecer en algún email
    const currentYear = String(new Date().getFullYear());
    const src = require('fs').readFileSync(require.resolve('../services/emailService'), 'utf8');
    assert.ok(!src.includes('© 2024'), 'año hardcodeado 2024 en emailService.js');
    assert.ok(src.includes('new Date().getFullYear()'), 'footer sin año dinámico');
    assert.ok(currentYear.length === 4);
  });
});
