/**
 * NutroVia — Tests del motor de planes (node:test)
 * Ejecutar: npm test
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { generatePersonalizedPlan } = require('../controllers/planEngine');

function makeProfile(overrides = {}) {
  return {
    age: 30, sex: 'hombre', weight_kg: 80, height_cm: 180, target_weight_kg: 75,
    goal: 'perder_peso', activity_level: 'moderado', dietary_preference: 'omnivoro',
    health_conditions: [], training_experience: 'intermedio',
    training_days_per_week: 3, training_equipment: 'gimnasio',
    ...overrides,
  };
}

describe('Motor de planes', () => {
  test('calorías seguras: suelo 1200 y tope 3500', () => {
    const p1 = generatePersonalizedPlan(makeProfile({
      sex: 'mujer', age: 30, weight_kg: 70, height_cm: 165, target_weight_kg: 68,
      activity_level: 'sedentario', training_equipment: 'casa',
    }));
    assert.ok(p1.daily_calories >= 1200, `kcal ${p1.daily_calories} < 1200`);
    assert.ok(p1.daily_calories <= 1800, `kcal ${p1.daily_calories} > 1800`);

    const p2 = generatePersonalizedPlan(makeProfile({
      age: 25, weight_kg: 85, height_cm: 180, target_weight_kg: null,
      goal: 'ganar_masa', activity_level: 'muy_activo', training_days_per_week: 4,
    }));
    assert.strictEqual(p2.daily_calories, 3500);
  });

  test('macros cuadran con las kcal (proteína*4 + carbs*4 + grasa*9 ≈ kcal)', () => {
    for (const profile of [
      makeProfile({}),
      makeProfile({ sex: 'mujer', goal: 'ganar_masa', activity_level: 'activo', dietary_preference: 'vegano', health_conditions: ['celiaquia'] }),
      makeProfile({ age: 16, sex: 'mujer', goal: 'perder_peso', activity_level: 'sedentario' }),
    ]) {
      const p = generatePersonalizedPlan(profile);
      const diff = Math.abs(p.protein_g * 4 + p.carbs_g * 4 + p.fat_g * 9 - p.daily_calories);
      assert.ok(diff < 60, `diferencia ${diff} kcal en perfil ${JSON.stringify(profile)}`);
    }
  });

  test('suelo calórico elevado para adolescentes (1600, no 1200)', () => {
    const p = generatePersonalizedPlan(makeProfile({
      age: 16, sex: 'mujer', weight_kg: 60, height_cm: 160, target_weight_kg: null,
      goal: 'perder_peso', activity_level: 'sedentario', training_equipment: 'casa',
    }));
    assert.ok(p.daily_calories >= 1600, `kcal ${p.daily_calories}`);
  });

  test('menú semanal de 7 días con las 5 comidas completas', () => {
    const p = generatePersonalizedPlan(makeProfile({}));
    assert.strictEqual(Object.keys(p.weekly_menu).length, 7);
    for (const day of Object.values(p.weekly_menu)) {
      for (const meal of ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena']) {
        assert.ok(day[meal], `falta ${meal} en ${JSON.stringify(day)}`);
        assert.ok(day[meal].nombre, `sin nombre en ${meal}`);
        assert.ok(Array.isArray(day[meal].ingredientes) && day[meal].ingredientes.length > 0, `sin ingredientes en ${meal}`);
        assert.ok(typeof day[meal].calorias === 'number', `calorias no numérico en ${meal}`);
      }
    }
  });

  test('sesiones de entrenamiento = training_days_per_week, repartidas por la semana', () => {
    // Con equipamiento 'mixto' el pool completo de perder_peso/intermedio tiene 4 sesiones
    const p = generatePersonalizedPlan(makeProfile({ training_days_per_week: 4, training_equipment: 'mixto' }));
    assert.strictEqual(p.training_plan.sesiones.length, 4);
    const dias = p.training_plan.sesiones.map(s => s.dia);
    assert.ok(dias[0] === 'Lunes', `primera sesión ${dias[0]}`);
    assert.ok(dias.includes('Jueves'), `reparto: ${JSON.stringify(dias)}`);
    assert.ok(Array.isArray(p.training_plan.progresion) && p.training_plan.progresion.length >= 3);
  });

  test('respeta el número de días pedido aunque el pool de plantillas sea menor', () => {
    // Gimnasio en perder_peso/intermedio: solo 3 de las 4 sesiones del pool son de gimnasio.
    // Aun así, si el usuario pide 4 días, se cicla el pool repartiendo días distintos.
    const p = generatePersonalizedPlan(makeProfile({ training_days_per_week: 4, training_equipment: 'gimnasio' }));
    assert.strictEqual(p.training_plan.sesiones.length, 4, 'sesiones');
    assert.strictEqual(p.training_plan.dias_semana, 4, 'dias_semana');
    const dias = p.training_plan.sesiones.map(s => s.dia);
    assert.strictEqual(new Set(dias).size, 4, `días distintos ${JSON.stringify(dias)}`);
  });

  test('con 6 días se generan 6 sesiones en días distintos', () => {
    const p = generatePersonalizedPlan(makeProfile({ training_days_per_week: 6, training_equipment: 'mixto' }));
    assert.strictEqual(p.training_plan.sesiones.length, 6);
    const dias = p.training_plan.sesiones.map(s => s.dia);
    assert.strictEqual(new Set(dias).size, 6, `días distintos ${JSON.stringify(dias)}`);
  });

  test('entrenar en casa no genera ejercicios de máquina', () => {
    const p = generatePersonalizedPlan(makeProfile({ training_equipment: 'casa' }));
    const ejercicios = JSON.stringify(p.training_plan.sesiones.map(s => s.ejercicios));
    const maquinas = ['Prensa', 'Jalón', 'Hack', 'Cuerda tríceps', 'barra', 'polea', 'TRX', 'Kettlebell'];
    for (const m of maquinas) {
      assert.ok(!ejercicios.includes(m), `máquina "${m}" en plan de casa`);
    }
    assert.strictEqual(p.training_plan.equipamiento, 'casa');
  });

  test('diabetes + hipertensión: notas de salud y exclusión de patata', () => {
    const p = generatePersonalizedPlan(makeProfile({
      health_conditions: ['diabetes', 'hipertension'], goal: 'perder_peso', activity_level: 'ligero',
    }));
    assert.ok(p.notas_dieta.some(n => n.includes('Diabetes')), 'sin nota de diabetes');
    assert.ok(p.notas_dieta.some(n => n.includes('Hipertensión')), 'sin nota de hipertensión');
    assert.ok(!JSON.stringify(p.weekly_menu).includes('Patata'), 'patata en menú de diabético');
    assert.ok(p.training_plan.notas.some(n => n.includes('glucemia')), 'sin nota de glucemia en entrenamiento');
  });

  test('vegano + celiaquía: sin productos animales ni gluten', () => {
    const p = generatePersonalizedPlan(makeProfile({
      sex: 'mujer', age: 22, weight_kg: 60, height_cm: 168, target_weight_kg: null,
      goal: 'mantener', dietary_preference: 'vegano', health_conditions: ['celiaquia'],
      training_equipment: 'mixto',
    }));
    const menu = JSON.stringify(p.weekly_menu);
    assert.ok(!menu.includes('Huevos') && !menu.includes('Salmón') && !menu.includes('Pollo'), 'producto animal en menú vegano');
    assert.ok(!menu.includes('Pan integral') && !menu.includes('Pasta integral'), 'gluten en menú celíaco');
    assert.ok(p.supplements.some(s => s.nombre.includes('B12')), 'sin B12 para vegano');
  });

  test('suplementos limpios: sin dosis para patologías', () => {
    const p = generatePersonalizedPlan(makeProfile({ health_conditions: ['hipertension'] }));
    const nombres = p.supplements.map(s => s.nombre).join(' ');
    assert.ok(!nombres.includes('Berberina'));
    assert.ok(!nombres.includes('L-Carnitina'));
    assert.ok(!nombres.includes('Magnesio glicinato'));
    assert.ok(p.consejos_generales.some(n => n.includes('orientativos')), 'sin disclaimer orientativo');
  });

  test('coherencia título ↔ ingredientes en todos los días y comidas', () => {
    function stripGrams(s) {
      return String(s).replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
    }
    function titleHas(plan, day, meal, idx) {
      const title = plan.weekly_menu[day][meal].nombre.toLowerCase();
      const ing = stripGrams(plan.weekly_menu[day][meal].ingredientes[idx]);
      return title.includes(ing);
    }

    const plans = [
      makeProfile({}),
      makeProfile({ sex: 'mujer', goal: 'ganar_masa', activity_level: 'activo', dietary_preference: 'vegano', health_conditions: ['celiaquia'] }),
      makeProfile({ age: 16, sex: 'mujer', goal: 'perder_peso', activity_level: 'sedentario', training_equipment: 'casa' }),
    ].map(generatePersonalizedPlan);

    const incoherentes = [];
    plans.forEach((p, pi) => {
      Object.keys(p.weekly_menu).forEach(day => {
        const m = p.weekly_menu[day];
        if (!titleHas(p, day, 'desayuno', 0) || !titleHas(p, day, 'desayuno', 1)) incoherentes.push(`P${pi + 1} ${day} desayuno`);
        if (!titleHas(p, day, 'almuerzo', 0)) incoherentes.push(`P${pi + 1} ${day} almuerzo`);
        if (!titleHas(p, day, 'comida', 0) || !titleHas(p, day, 'comida', 1) || !titleHas(p, day, 'comida', 2)) incoherentes.push(`P${pi + 1} ${day} comida`);
        if (!titleHas(p, day, 'merienda', 0)) incoherentes.push(`P${pi + 1} ${day} merienda`);
        if (!titleHas(p, day, 'cena', 0) || !titleHas(p, day, 'cena', 1)) incoherentes.push(`P${pi + 1} ${day} cena`);
        if (m.desayuno.nombre.toLowerCase().includes('aceite')) incoherentes.push(`P${pi + 1} ${day} desayuno-aceite`);
        if (m.merienda.nombre.toLowerCase().includes('aceite')) incoherentes.push(`P${pi + 1} ${day} merienda-aceite`);
      });
    });
    assert.deepStrictEqual(incoherentes, [], incoherentes.slice(0, 10).join(', '));
  });
});
