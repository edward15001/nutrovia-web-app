/**
 * NutroVia — Tests del servicio de visión (aiVisionService)
 * Se centra en compareWithPlan (lógica pura de comparar kcal con el plan),
 * que decide si una comida registrada "encaja" con el objetivo diario.
 * (El análisis de imagen requiere red a Groq y no se testea aquí.)
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');

const { compareWithPlan } = require('../services/aiVisionService');

describe('aiVisionService.compareWithPlan', () => {
  test('sin plan → no compara y avisa de que falta el plan', () => {
    const r = compareWithPlan(600, null);
    assert.strictEqual(r.matches_plan, null);
    assert.match(r.feedback, /cuestionario/i);
  });

  test('ración razonable (≈20% del día) → dentro del plan', () => {
    const plan = { daily_calories: 2000 };
    const r = compareWithPlan(400, plan);
    assert.strictEqual(r.matches_plan, 'dentro');
    assert.match(r.feedback, /20%/);
  });

  test('ración demasiado grande (>35% del día) → fuera del plan', () => {
    const plan = { daily_calories: 2000 };
    const r = compareWithPlan(1000, plan);
    assert.strictEqual(r.matches_plan, 'fuera');
    assert.match(r.feedback, /50%/);
  });

  test('plato muy pequeño (<80 kcal) no se marca como fuera', () => {
    const plan = { daily_calories: 2000 };
    const r = compareWithPlan(15, plan);
    assert.strictEqual(r.matches_plan, 'dentro');
  });

  test('plan con 1200 kcal: 400 kcal ya es el 33% y entra justo', () => {
    const plan = { daily_calories: 1200 };
    const r = compareWithPlan(400, plan);
    assert.strictEqual(r.matches_plan, 'dentro');
  });

  test('plan con 1200 kcal: 500 kcal (42%) → fuera', () => {
    const plan = { daily_calories: 1200 };
    const r = compareWithPlan(500, plan);
    assert.strictEqual(r.matches_plan, 'fuera');
  });
});