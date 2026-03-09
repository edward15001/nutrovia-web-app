const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
}

const BASE_STYLE = `
  font-family: 'Arial', sans-serif;
  background-color: #0d0d0d;
  color: #e8e0d0;
  max-width: 580px;
  margin: 0 auto;
  border-radius: 12px;
  overflow: hidden;
`;

const GOLD = '#c9a84c';

function emailWrapper(content) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="margin:0;padding:20px;background:#111;">
      <div style="${BASE_STYLE}">
        <div style="background:linear-gradient(135deg,#1a1a1a,#0d0d0d);padding:30px;text-align:center;border-bottom:2px solid ${GOLD};">
          <h1 style="color:${GOLD};margin:0;font-size:28px;letter-spacing:3px;">NUTROVIA</h1>
          <p style="color:#888;margin:5px 0 0;font-size:12px;letter-spacing:2px;">NUTRICIÓN & ENTRENAMIENTO</p>
        </div>
        <div style="padding:35px 30px;">
          ${content}
        </div>
        <div style="background:#111;padding:20px;text-align:center;border-top:1px solid #222;">
          <p style="color:#555;font-size:11px;margin:0;">
            © 2024 NutroVia. Todos los derechos reservados.<br>
            <a href="${process.env.APP_URL}" style="color:${GOLD};text-decoration:none;">${process.env.APP_URL}</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendEmail(to, subject, htmlContent) {
  try {
    if (!transporter) {
      console.log(`[Mock Email] Destino: ${to} | Asunto: ${subject}`);
      return true;
    }
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `NutroVia <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: emailWrapper(htmlContent),
    });
    console.log(`📧 Email enviado a ${to}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ Error enviando email a ${to}:`, err.message);
    return false;
  }
}

/** 1. Bienvenida tras registro */
async function sendWelcomeEmail(user, trialEndDate) {
  const fecha = new Date(trialEndDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return sendEmail(
    user.email,
    '¡Bienvenido/a a NutroVia! Tu prueba gratuita ha comenzado 🌿',
    `
    <h2 style="color:${GOLD};margin-top:0;">¡Hola, ${user.name}!</h2>
    <p style="line-height:1.7;color:#ccc;">Nos alegra tenerte en la familia <strong style="color:${GOLD};">NutroVia</strong>. Tu plan personalizado de nutrición y entrenamiento ya está disponible.</p>
    <div style="background:#1a1a1a;border-left:3px solid ${GOLD};padding:15px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0;color:#aaa;font-size:13px;">🗓 TU PRUEBA GRATUITA</p>
      <p style="margin:5px 0 0;color:#fff;font-size:16px;font-weight:bold;">Hasta el ${fecha}</p>
    </div>
    <p style="color:#aaa;font-size:14px;line-height:1.7;">Durante estos 30 días disfruta de acceso completo a tu plan sin ningún coste. Después tendrás 15 días adicionales para decidir si quieres continuar.</p>
    <div style="text-align:center;margin-top:30px;">
      <a href="${process.env.APP_URL}/dashboard.html" style="background:${GOLD};color:#0d0d0d;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block;">Ver mi plan personalizado</a>
    </div>
    `
  );
}

/** 2. Aviso fin de prueba (día 30) */
async function sendTrialEndingEmail(user, cancelWindowEndDate) {
  const fecha = new Date(cancelWindowEndDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return sendEmail(
    user.email,
    'Tu prueba gratuita ha finalizado — Tienes 15 días para cancelar',
    `
    <h2 style="color:${GOLD};margin-top:0;">Tu prueba ha finalizado, ${user.name}</h2>
    <p style="line-height:1.7;color:#ccc;">Esperamos que hayas disfrutado de NutroVia. Tu suscripción se activará automáticamente el <strong style="color:#fff;">${fecha}</strong> si no la cancelas antes.</p>
    <div style="background:#1a1a2a;border:1px solid #c9a84c44;padding:20px;border-radius:8px;margin:20px 0;">
      <p style="margin:0;color:${GOLD};font-weight:bold;">⏰ TIENES 15 DÍAS PARA DECIDIR</p>
      <p style="margin:10px 0 0;color:#ccc;font-size:14px;">Si decides continuar, a partir del ${fecha} se te cobrará <strong style="color:#fff;">60 € / mes</strong> el mismo día del mes en que te inscribiste.</p>
    </div>
    <div style="text-align:center;margin-top:25px;">
      <a href="${process.env.APP_URL}/dashboard.html" style="background:#1a1a1a;color:${GOLD};padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;border:1px solid ${GOLD};display:inline-block;margin-right:10px;">Gestionar suscripción</a>
    </div>
    `
  );
}

/** 3. Aviso cobro inminente (día 44, cobro mañana día 45) */
async function sendChargeWarningEmail(user, chargeDate) {
  const fecha = new Date(chargeDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return sendEmail(
    user.email,
    `Aviso: Mañana se activa tu suscripción NutroVia — ${fecha}`,
    `
    <h2 style="color:${GOLD};margin-top:0;">Último aviso, ${user.name}</h2>
    <p style="line-height:1.7;color:#ccc;">Mañana, <strong style="color:#fff;">${fecha}</strong>, se realizará el primer cargo de <strong style="color:#fff;">60 €</strong> en tu método de pago registrado.</p>
    <div style="background:#1a0a0a;border-left:3px solid #c94c4c;padding:15px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0;color:#e88;font-size:13px;">⚠️ Si quieres cancelar, debes hacerlo antes de mañana</p>
    </div>
    <p style="color:#999;font-size:13px;line-height:1.7;">Ten en cuenta: si cancelas a partir de mañana, el cargo ya estará realizado y la cancelación será efectiva para el siguiente mes.</p>
    <div style="text-align:center;margin-top:25px;">
      <a href="${process.env.APP_URL}/dashboard.html" style="background:#1a1a1a;color:#e88;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;border:1px solid #c94c4c;display:inline-block;">Cancelar suscripción</a>
    </div>
    `
  );
}

/** 4. Confirmación de pago */
async function sendPaymentConfirmedEmail(user, amount, nextBillingDate) {
  const fechaProx = new Date(nextBillingDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return sendEmail(
    user.email,
    `Pago confirmado: ${amount} € — NutroVia`,
    `
    <h2 style="color:${GOLD};margin-top:0;">Pago recibido ✓</h2>
    <p style="color:#ccc;">Hemos procesado correctamente tu pago de <strong style="color:#fff;">${amount} €</strong>. Gracias por continuar con NutroVia.</p>
    <p style="color:#aaa;font-size:14px;">Tu próxima factura será el <strong style="color:#fff;">${fechaProx}</strong>.</p>
    <div style="text-align:center;margin-top:25px;">
      <a href="${process.env.APP_URL}/dashboard.html" style="background:${GOLD};color:#0d0d0d;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Acceder a mi plan</a>
    </div>
    `
  );
}

/** 5. Confirmación de cancelación */
async function sendCancellationEmail(user, effectiveDate) {
  const fecha = new Date(effectiveDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return sendEmail(
    user.email,
    'Suscripción cancelada — NutroVia',
    `
    <h2 style="color:#ccc;margin-top:0;">Suscripción cancelada</h2>
    <p style="color:#aaa;line-height:1.7;">Hemos procesado la cancelación de tu suscripción NutroVia. Seguirás teniendo acceso a tu plan hasta el <strong style="color:#fff;">${fecha}</strong>.</p>
    <p style="color:#777;font-size:13px;">Si cambiaste de opinión, puedes volver a suscribirte en cualquier momento desde tu panel.</p>
    <div style="text-align:center;margin-top:25px;">
      <a href="${process.env.APP_URL}" style="background:#1a1a1a;color:${GOLD};padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;border:1px solid ${GOLD};display:inline-block;">Volver a NutroVia</a>
    </div>
    `
  );
}

/** 6. Envío del plan nutricional */
async function sendNutritionPlanEmail(user, plan) {
  return sendEmail(
    user.email,
    `Tu Plan Personalizado NutroVia está listo 🥗`,
    `
    <h2 style="color:${GOLD};margin-top:0;">¡Aquí tienes tu plan, ${user.name}!</h2>
    <p style="line-height:1.7;color:#ccc;">Tu motor de inteligencia nutricional ha terminado de procesar tus datos. Aquí tienes el resumen de tu plan:</p>
    
    <div style="background:#1a1a1a;border-left:3px solid ${GOLD};padding:15px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0;color:#aaa;font-size:13px;">📊 TUS MACROS DIARIOS</p>
      <div style="margin-top:10px; display:flex; justify-content:space-between; color:#fff; font-weight:bold;">
        <div>🔥 ${plan.daily_calories} kcal</div>
        <div>🥩 ${plan.protein_g}g Prot</div>
        <div>🍚 ${plan.carbs_g}g Carb</div>
        <div>🥑 ${plan.fat_g}g Grasas</div>
      </div>
    </div>
    
    <p style="color:#aaa;font-size:14px;line-height:1.7;">Ingresa en tu panel de control para ver el menú de 7 días, tu rutina de entrenamiento y tu lista de suplementación detallada.</p>
    
    <div style="text-align:center;margin-top:30px;">
      <a href="${process.env.APP_URL}/dashboard.html" style="background:${GOLD};color:#0d0d0d;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block;">Ver mi plan completo</a>
    </div>
    `
  );
}

module.exports = {
  sendWelcomeEmail,
  sendTrialEndingEmail,
  sendChargeWarningEmail,
  sendPaymentConfirmedEmail,
  sendCancellationEmail,
  sendNutritionPlanEmail,
};
