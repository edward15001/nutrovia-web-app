/**
 * Vytal — Tests del intercambio de comidas del calendario (node:test)
 * Ejecutar: npm test
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { applySwap } = require('../controllers/planSwap');

function makeMenu() {
  return {
    Lunes: {
      desayuno: { nombre: 'Avena con plátano', calorias: 420, ingredientes: ['Avena 60g', 'Plátano'] },
      comida: { nombre: 'Pollo al limón', calorias: 820, ingredientes: ['Pechuga 180g'] },
      cena: { nombre: 'Salmón con patata', calorias: 610, ingredientes: ['Salmón 150g'] },
    },
    Martes: {
      desayuno: { nombre: 'Yogur con frutos rojos', calorias: 380, ingredientes: ['Yogur 200g'] },
      comida: { nombre: 'Lentejas estofadas', calorias: 790, ingredientes: ['Lentejas 80g'] },
      cena: { nombre: 'Tortilla de verduras', calorias: 540, ingredientes: ['Huevo 3'] },
    },
  };
}

describe('Intercambio de comidas (planSwap)', () => {
  test('intercambia una comida y no muta el menú original', () => {
    const menu = makeMenu();
    const rep = { nombre: 'Lentejas estofadas', calorias: 790, ingredientes: ['Lentejas 80g'] };
    const r = applySwap(menu, 'Lunes', 'comida', rep);
    assert.ok(r.ok);
    assert.strictEqual(r.menu.Lunes.comida.nombre, 'Lentejas estofadas');
    assert.strictEqual(r.menu.Lunes.comida.calorias, 790);
    // Original intacto (sin mutación)
    assert.strictEqual(menu.Lunes.comida.nombre, 'Pollo al limón');
    // Resto del día intacto
    assert.strictEqual(r.menu.Lunes.desayuno.nombre, 'Avena con plátano');
  });

  test('rechaza día inválido', () => {
    const r = applySwap(makeMenu(), 'Octavo', 'comida', { nombre: 'X', calorias: 100 });
    assert.strictEqual(r.error, 'Día inválido');
  });

  test('rechaza comida inválida', () => {
    const r = applySwap(makeMenu(), 'Lunes', 'postre', { nombre: 'X', calorias: 100 });
    assert.strictEqual(r.error, 'Comida inválida');
  });

  test('rechaza sustitución sin nombre o sin calorías válidas', () => {
    assert.strictEqual(applySwap(makeMenu(), 'Lunes', 'comida', null).error, 'Sustitución inválida');
    assert.strictEqual(applySwap(makeMenu(), 'Lunes', 'comida', { calorias: 100 }).error, 'La comida debe tener nombre');
    assert.strictEqual(applySwap(makeMenu(), 'Lunes', 'comida', { nombre: 'X', calorias: 'abc' }).error, 'La comida debe tener calorías válidas');
    assert.strictEqual(applySwap(makeMenu(), 'Lunes', 'comida', { nombre: 'X', calorias: 0 }).error, 'La comida debe tener calorías válidas');
  });

  test('rechaza día inexistente en el menú', () => {
    const r = applySwap({ Lunes: {} }, 'Martes', 'comida', { nombre: 'X', calorias: 100 });
    assert.strictEqual(r.error, 'Día no encontrado en el plan');
  });

  test('normaliza nombre largo y calorías por encima del tope', () => {
    const r = applySwap(makeMenu(), 'Lunes', 'cena', {
      nombre: 'x'.repeat(300), calorias: 99999, ingredientes: ['a', 'b'],
    });
    assert.ok(r.ok);
    assert.strictEqual(r.menu.Lunes.cena.nombre.length, 200);
    assert.strictEqual(r.menu.Lunes.cena.calorias, 5000);
  });
});
