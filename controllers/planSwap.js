/**
 * NutroVia — Lógica de intercambio de comidas del menú semanal.
 * Función pura (testeable sin BD): valida y produce el menú actualizado.
 */
const VALID_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const VALID_MEALS = ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena'];

/**
 * Aplica un intercambio sobre una copia del menú.
 * @param {object} menu         weekly_menu actual (del plan del usuario)
 * @param {string} day          día objetivo (p.ej. 'Miércoles')
 * @param {string} mealKey      comida (desayuno|almuerzo|comida|merienda|cena)
 * @param {object} replacement  comida sustituta { nombre, calorias, ingredientes? }
 * @returns {{ ok: true, menu: object } | { error: string }}
 */
function applySwap(menu, day, mealKey, replacement) {
  if (!VALID_DAYS.includes(day)) return { error: 'Día inválido' };
  if (!VALID_MEALS.includes(mealKey)) return { error: 'Comida inválida' };
  if (!replacement || typeof replacement !== 'object' || Array.isArray(replacement)) {
    return { error: 'Sustitución inválida' };
  }
  if (!replacement.nombre || typeof replacement.nombre !== 'string') {
    return { error: 'La comida debe tener nombre' };
  }
  const calorias = Number(replacement.calorias);
  if (!Number.isFinite(calorias) || calorias <= 0) {
    return { error: 'La comida debe tener calorías válidas' };
  }
  if (!menu || typeof menu !== 'object' || Array.isArray(menu) || !menu[day] || typeof menu[day] !== 'object') {
    return { error: 'Día no encontrado en el plan' };
  }

  const next = JSON.parse(JSON.stringify(menu));
  next[day][mealKey] = {
    nombre: String(replacement.nombre).trim().slice(0, 200),
    calorias: Math.round(Math.min(calorias, 5000)),
    ingredientes: Array.isArray(replacement.ingredientes)
      ? replacement.ingredientes.slice(0, 20).map(i => String(i).trim().slice(0, 200))
      : [],
  };
  return { ok: true, menu: next };
}

module.exports = { applySwap, VALID_DAYS, VALID_MEALS };
