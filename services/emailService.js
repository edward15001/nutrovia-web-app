const nodemailer = require('nodemailer');

let transporter = null;
// Solo crear el transporter si hay credenciales reales. Si SMTP_USER es el
// placeholder del .env.example (o está vacío), usamos el modo mock para que
// el desarrollo local no intente autenticarse contra Gmail con claves falsas.
const SMTP_USER = process.env.SMTP_USER || '';
const isPlaceholderSmtp = !SMTP_USER
  || SMTP_USER.includes('tu_email')
  || SMTP_USER.includes('TU_EMAIL')
  || /^[A-Z_]+$/.test(SMTP_USER);
if (process.env.SMTP_HOST && !isPlaceholderSmtp) {
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

// Precio mensual del plan (para los textos de los emails)
const PLAN_PRICE_EUR = process.env.PLAN_PRICE_EUR || '14';

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
            © ${new Date().getFullYear()} NutroVia. Todos los derechos reservados.<br>
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

/** 0. Aviso al equipo: nuevo usuario registrado */
async function sendNewUserNotificationEmail(user) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn('⚠️  ADMIN_EMAIL no configurado — no se envió aviso de nuevo usuario');
    return false;
  }
  const fecha = new Date().toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return sendEmail(
    adminEmail,
    `🆕 Nuevo usuario en NutroVia: ${user.name}`,
    `
    <h2 style="color:${GOLD};margin-top:0;">Nuevo registro en NutroVia</h2>
    <p style="line-height:1.7;color:#ccc;">Se acaba de registrar un nuevo usuario en la plataforma.</p>
    <div style="background:#1a1a1a;border-left:3px solid ${GOLD};padding:20px;border-radius:8px;margin:20px 0;">
      <p style="margin:0;color:#aaa;font-size:13px;">👤 NOMBRE</p>
      <p style="margin:5px 0 0;color:#fff;font-size:16px;font-weight:bold;">${user.name}</p>
      <p style="margin:18px 0 0;color:#aaa;font-size:13px;">📧 EMAIL</p>
      <p style="margin:5px 0 0;color:#fff;font-size:16px;font-weight:bold;">${user.email}</p>
      <p style="margin:18px 0 0;color:#aaa;font-size:13px;">🕒 FECHA DE REGISTRO</p>
      <p style="margin:5px 0 0;color:#fff;font-size:16px;font-weight:bold;">${fecha}</p>
    </div>
    <div style="text-align:center;margin-top:25px;">
      <a href="${process.env.APP_URL}/dashboard.html" style="background:${GOLD};color:#0d0d0d;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;display:inline-block;">Ir al panel de NutroVia</a>
    </div>
    `
  );
}

/** 1. Bienvenida tras activar Pro */
async function sendWelcomeEmail(user, nextBillingDate) {
  const fecha = new Date(nextBillingDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return sendEmail(
    user.email,
    '¡Bienvenido/a a NutroVia Pro! Tu plan está activo 🏆',
    `
    <h2 style="color:${GOLD};margin-top:0;">¡Hola, ${user.name}!</h2>
    <p style="line-height:1.7;color:#ccc;">Nos alegra tenerte en la familia <strong style="color:${GOLD};">NutroVia</strong>. Tu plan Pro está activo y tu plan personalizado de nutrición y entrenamiento ya está disponible.</p>
    <div style="background:#1a1a1a;border-left:3px solid ${GOLD};padding:15px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0;color:#aaa;font-size:13px;">💳 TU SUSCRIPCIÓN PRO</p>
      <p style="margin:5px 0 0;color:#fff;font-size:16px;font-weight:bold;">${PLAN_PRICE_EUR} € / mes · Próximo cobro: ${fecha}</p>
    </div>
    <p style="color:#aaa;font-size:14px;line-height:1.7;">Puedes dejar de pagar cuando quieras desde tu panel y volver al plan gratuito. Mientras estés en Pro disfrutas del menú detallado, la suplementación, la IA y los check-ins.</p>
    <div style="text-align:center;margin-top:30px;">
      <a href="${process.env.APP_URL}/dashboard.html" style="background:${GOLD};color:#0d0d0d;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block;">Ver mi plan personalizado</a>
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

/** 5. Confirmación de cancelación (vuelta al plan gratuito) */
async function sendCancellationEmail(user, effectiveDate) {
  const fecha = new Date(effectiveDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return sendEmail(
    user.email,
    'Has vuelto al plan gratuito — NutroVia',
    `
    <h2 style="color:#ccc;margin-top:0;">Has vuelto al plan gratuito</h2>
    <p style="color:#aaa;line-height:1.7;">Hemos dejado de cobrarte el plan Pro. Seguirás teniendo acceso a tu plan hasta el <strong style="color:#fff;">${fecha}</strong> y después seguirás usando NutroVia gratis.</p>
    <p style="color:#777;font-size:13px;">Si cambiaste de opinión, puedes actualizar a Pro en cualquier momento desde tu panel.</p>
    <div style="text-align:center;margin-top:25px;">
      <a href="${process.env.APP_URL}" style="background:#1a1a1a;color:${GOLD};padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;border:1px solid ${GOLD};display:inline-block;">Volver a NutroVia</a>
    </div>
    `
  );
}

/** 6. Check-in semanal: "¿Cómo va ese progreso?" */
async function sendCheckinEmail(user) {
  return sendEmail(
    user.email,
    '¿Cómo va ese progreso? 🌱 NutroVia',
    `
    <h2 style="color:${GOLD};margin-top:0;">¿Cómo va ese progreso, ${user.name}?</h2>
    <p style="line-height:1.7;color:#ccc;">Llevas una semana sin actualizar tus datos. Tu plan se adapta a ti, así que cuéntanos cómo va todo:</p>
    <div style="text-align:center;margin-top:25px;">
      <a href="${process.env.APP_URL}/dashboard.html" style="background:${GOLD};color:#0d0d0d;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block;">Actualizar mi progreso</a>
    </div>
    <p style="color:#777;font-size:13px;line-height:1.7;margin-top:20px;">Puedes registrar de nuevo tus valores (peso, objetivo, actividad...) cuando quieras y tu plan se recalculará al momento.</p>
    `
  );
}

/** 7. Envío del plan nutricional */
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
  sendNewUserNotificationEmail,
  sendWelcomeEmail,
  sendPaymentConfirmedEmail,
  sendCancellationEmail,
  sendCheckinEmail,
  sendNutritionPlanEmail,
};
