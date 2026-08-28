// ─── NutroVia — services/accessService.js ────────────────────
// Controla el acceso según el nivel del usuario: FREE (de por vida,
// con funciones restringidas) o PRO (plan completo por 14 €/mes).
// El tier PRO se deriva del estado de la suscripción en Stripe:
// trial / active / past_due cuentan como PRO mientras dure el acceso.

const db = require('../db/db');

// ─── Permisos por nivel ─────────────────────────────────────
const ACCESS = {
  free: {
    label: 'Free',
    // Máximo de veces que puede regenerar su plan al cambiar el cuestionario
    // (generoso para no frustrar el cambio de plan; el Pro es ilimitado)
    maxRegenerations: 5,
    // Generación de menú/entrenamiento/suplementos por IA (solo motor determinista)
    hasIA: false,
    // Lista de suplementación (Pro only)
    hasSupplements: false,
    // Check-in semanal "¿Cómo va ese progreso?" (Pro only)
    hasCheckins: false,
    // "A oscuras": ve macros/calorías pero no el detalle de comidas del menú
    hasMealDetail: false,
  },
  pro: {
    label: 'Pro',
    maxRegenerations: null, // Ilimitado
    hasIA: true,
    hasSupplements: true,
    hasCheckins: true,
    hasMealDetail: true,
  },
};

// Estados de suscripción que conceden acceso PRO
const PRO_STATUSES = ['trial', 'active', 'past_due'];

// ─── Tier y permisos de un usuario ──────────────────────────
// Devuelve { tier, permissions, regenerationsUsed, maxRegenerations, canRegenerate }
async function getUserAccess(userId) {
  const subResult = await db.query(
    `SELECT status FROM subscriptions WHERE user_id = $1`,
    [userId]
  );

  let tier = 'free';
  if (subResult.rows.length > 0 && PRO_STATUSES.includes(subResult.rows[0].status)) {
    tier = 'pro';
  }

  const regResult = await db.query(
    `SELECT plan_regeneration_count FROM users WHERE id = $1`,
    [userId]
  );

  const regenerationsUsed = regResult.rows.length > 0
    ? (regResult.rows[0].plan_regeneration_count || 0)
    : 0;

  const permissions = ACCESS[tier];

  return {
    tier,
    isPro: tier === 'pro',
    label: permissions.label,
    ...permissions,
    regenerationsUsed,
    maxRegenerations: permissions.maxRegenerations,
    canRegenerate: permissions.maxRegenerations === null ||
      regenerationsUsed < permissions.maxRegenerations,
  };
}

// ─── Incrementa el contador de regeneraciones ───────────────
// Solo aplica al tier free (el pro es ilimitado). Se incrementa cada vez
// que el usuario regenera su plan editando el cuestionario.
async function incrementRegeneration(userId) {
  await db.query(
    `UPDATE users SET plan_regeneration_count = plan_regeneration_count + 1 WHERE id = $1`,
    [userId]
  );
}

module.exports = {
  ACCESS,
  getUserAccess,
  incrementRegeneration,
};