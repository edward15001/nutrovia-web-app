/**
 * NutroVia — Tests del servicio de IA de planes
 * - Sin OPENAI_API_KEY → isConfigured() false y genera null (fallback al motor)
 * - Con clave y respuesta HTTP de error → null
 * - Con respuesta JSON válida → plan normalizado
 * - Con respuesta JSON inválida → null
 */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

function validAIContent() {
  return JSON.stringify({
    weekly_menu: {
      Lunes: {
        desayuno: { nombre: 'Avena con frutos rojos', calorias: 400, ingredientes: ['Avena (70g)', 'Frutos rojos'] },
        almuerzo: { nombre: 'Yogur con frutos secos', calorias: 200, ingredientes: ['Yogur griego', 'Frutos secos'] },
        comida: { nombre: 'Pollo a la plancha con quinoa', calorias: 550, ingredientes: ['Pollo (150g)', 'Quinoa (80g)', 'Verduras'] },
        merienda: { nombre: 'Fruta con canela', calorias: 150, ingredientes: ['Manzana', 'Canela'] },
        cena: { nombre: 'Tortilla con ensalada', calorias: 400, ingredientes: ['Huevos (2)', 'Lechuga', 'Tomate'] },
      },
      Martes: {
        desayuno: { nombre: 'Tostadas con aguacate', calorias: 400, ingredientes: ['Pan integral', 'Aguacate'] },
        almuerzo: { nombre: 'Batido de proteína', calorias: 200, ingredientes: ['Proteína (30g)', 'Plátano'] },
        comida: { nombre: 'Salmón con patata', calorias: 550, ingredientes: ['Salmón (150g)', 'Patata', 'Espárragos'] },
        merienda: { nombre: 'Puñado de frutos secos', calorias: 150, ingredientes: ['Almendras', 'Nueces'] },
        cena: { nombre: 'Crema de verduras', calorias: 400, ingredientes: ['Calabacín', 'Puerro', 'Papa'] },
      },
      Miércoles: {
        desayuno: { nombre: 'Avena con frutos rojos', calorias: 400, ingredientes: ['Avena (70g)', 'Frutos rojos'] },
        almuerzo: { nombre: 'Yogur con frutos secos', calorias: 200, ingredientes: ['Yogur griego', 'Frutos secos'] },
        comida: { nombre: 'Pollo a la plancha con quinoa', calorias: 550, ingredientes: ['Pollo (150g)', 'Quinoa (80g)', 'Verduras'] },
        merienda: { nombre: 'Fruta con canela', calorias: 150, ingredientes: ['Manzana', 'Canela'] },
        cena: { nombre: 'Tortilla con ensalada', calorias: 400, ingredientes: ['Huevos (2)', 'Lechuga', 'Tomate'] },
      },
      Jueves: {
        desayuno: { nombre: 'Tostadas con aguacate', calorias: 400, ingredientes: ['Pan integral', 'Aguacate'] },
        almuerzo: { nombre: 'Batido de proteína', calorias: 200, ingredientes: ['Proteína (30g)', 'Plátano'] },
        comida: { nombre: 'Salmón con patata', calorias: 550, ingredientes: ['Salmón (150g)', 'Patata', 'Espárragos'] },
        merienda: { nombre: 'Puñado de frutos secos', calorias: 150, ingredientes: ['Almendras', 'Nueces'] },
        cena: { nombre: 'Crema de verduras', calorias: 400, ingredientes: ['Calabacín', 'Puerro', 'Papa'] },
      },
      Viernes: {
        desayuno: { nombre: 'Avena con frutos rojos', calorias: 400, ingredientes: ['Avena (70g)', 'Frutos rojos'] },
        almuerzo: { nombre: 'Yogur con frutos secos', calorias: 200, ingredientes: ['Yogur griego', 'Frutos secos'] },
        comida: { nombre: 'Pollo a la plancha con quinoa', calorias: 550, ingredientes: ['Pollo (150g)', 'Quinoa (80g)', 'Verduras'] },
        merienda: { nombre: 'Fruta con canela', calorias: 150, ingredientes: ['Manzana', 'Canela'] },
        cena: { nombre: 'Tortilla con ensalada', calorias: 400, ingredientes: ['Huevos (2)', 'Lechuga', 'Tomate'] },
      },
      Sábado: {
        desayuno: { nombre: 'Tostadas con aguacate', calorias: 400, ingredientes: ['Pan integral', 'Aguacate'] },
        almuerzo: { nombre: 'Batido de proteína', calorias: 200, ingredientes: ['Proteína (30g)', 'Plátano'] },
        comida: { nombre: 'Salmón con patata', calorias: 550, ingredientes: ['Salmón (150g)', 'Patata', 'Espárragos'] },
        merienda: { nombre: 'Puñado de frutos secos', calorias: 150, ingredientes: ['Almendras', 'Nueces'] },
        cena: { nombre: 'Crema de verduras', calorias: 400, ingredientes: ['Calabacín', 'Puerro', 'Papa'] },
      },
      Domingo: {
        desayuno: { nombre: 'Avena con frutos rojos', calorias: 400, ingredientes: ['Avena (70g)', 'Frutos rojos'] },
        almuerzo: { nombre: 'Yogur con frutos secos', calorias: 200, ingredientes: ['Yogur griego', 'Frutos secos'] },
        comida: { nombre: 'Pollo a la plancha con quinoa', calorias: 550, ingredientes: ['Pollo (150g)', 'Quinoa (80g)', 'Verduras'] },
        merienda: { nombre: 'Fruta con canela', calorias: 150, ingredientes: ['Manzana', 'Canela'] },
        cena: { nombre: 'Tortilla con ensalada', calorias: 400, ingredientes: ['Huevos (2)', 'Lechuga', 'Tomate'] },
      },
    },
    training_plan: {
      nivel: 'intermedio',
      objetivo: 'perder_peso',
      dias_semana: 3,
      equipamiento: 'gimnasio',
      sesiones: [{ dia: 'Lunes', tipo: 'Tren superior', ejercicios: ['Press banca 4x10', 'Remo 4x10'] }],
      progresion: ['Semana 1-2: aprendizaje', 'Semana 3-4: +2.5kg'],
      notas: ['Hidrátate bien'],
    },
    supplements: [{ nombre: 'Proteína whey', dosis: '1 scoop', motivo: 'Alcanzar proteína diaria' }],
    notas_dieta: ['Bebe 2L de agua al día'],
    consejos_generales: ['Duerme 7-8 horas'],
  });
}

function mockFetchResponse(body, ok = true, status = 200) {
  return async () => ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  });
}

describe('aiPlanService', () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete require.cache[require.resolve('../services/aiPlanService')];
  });

  test('sin API key no está configurado', () => {
    const svc = require('../services/aiPlanService');
    assert.strictEqual(svc.isConfigured(), false);
  });

  test('sin API key genera null (fallback al motor)', async () => {
    const svc = require('../services/aiPlanService');
    const plan = await svc.generatePersonalizedPlanWithAI({}, { daily_calories: 2000, protein_g: 120, carbs_g: 200, fat_g: 70 });
    assert.strictEqual(plan, null);
  });

  test('con API key está configurado', () => {
    process.env.OPENAI_API_KEY = 'gsk_test_123';
    const svc = require('../services/aiPlanService');
    assert.strictEqual(svc.isConfigured(), true);
  });

  test('respuesta HTTP de error → null (fallback al motor)', async () => {
    process.env.OPENAI_API_KEY = 'gsk_test_123';
    global.fetch = mockFetchResponse({ error: { message: 'rate limit' } }, false, 429);
    const svc = require('../services/aiPlanService');
    const plan = await svc.generatePersonalizedPlanWithAI(
      { health_conditions: ['ninguna'] },
      { daily_calories: 2000, protein_g: 120, carbs_g: 200, fat_g: 70 }
    );
    assert.strictEqual(plan, null);
    delete global.fetch;
  });

  test('respuesta JSON válida → plan normalizado con weekly_menu', async () => {
    process.env.OPENAI_API_KEY = 'gsk_test_123';
    global.fetch = mockFetchResponse({
      choices: [{ message: { content: validAIContent() }, finish_reason: 'stop' }],
      usage: { total_tokens: 500 },
    });
    const svc = require('../services/aiPlanService');
    const plan = await svc.generatePersonalizedPlanWithAI(
      { health_conditions: ['ninguna'], dietary_preference: 'omnivoro' },
      { daily_calories: 2000, protein_g: 120, carbs_g: 200, fat_g: 70 }
    );
    assert.ok(plan, 'plan no generado');
    assert.ok(plan.weekly_menu, 'sin weekly_menu');
    assert.strictEqual(Object.keys(plan.weekly_menu).length, 7);
    assert.strictEqual(plan.training_plan.sesiones.length, 1);
    delete global.fetch;
  });

  test('JSON no parseable → null', async () => {
    process.env.OPENAI_API_KEY = 'gsk_test_123';
    global.fetch = mockFetchResponse({
      choices: [{ message: { content: 'esto no es JSON {', finish_reason: 'stop' } }],
    });
    const svc = require('../services/aiPlanService');
    const plan = await svc.generatePersonalizedPlanWithAI(
      { health_conditions: ['ninguna'] },
      { daily_calories: 2000, protein_g: 120, carbs_g: 200, fat_g: 70 }
    );
    assert.strictEqual(plan, null);
    delete global.fetch;
  });

  test('menú con alimentos prohibidos para vegano → menú descartado', async () => {
    process.env.OPENAI_API_KEY = 'gsk_test_123';
    // La IA responde con pollo (prohibido para vegano)
    global.fetch = mockFetchResponse({
      choices: [{ message: { content: validAIContent() }, finish_reason: 'stop' }],
    });
    const svc = require('../services/aiPlanService');
    const plan = await svc.generatePersonalizedPlanWithAI(
      { health_conditions: ['ninguna'], dietary_preference: 'vegano' },
      { daily_calories: 2000, protein_g: 120, carbs_g: 200, fat_g: 70 }
    );
    assert.ok(plan, 'plan no generado');
    assert.strictEqual(plan.weekly_menu, null, 'el menú prohibido debería descartarse');
    delete global.fetch;
  });
});
