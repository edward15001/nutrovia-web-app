/**
 * Verificación del motor de planes (Fase A).
 * Ejecutar: node test_plan_engine.js
 * Comprueba: calorías seguras, porciones coherentes, reglas de salud,
 * suplementos limpios y entrenamiento según equipamiento.
 */
const { generatePersonalizedPlan } = require('./controllers/planEngine');

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

// ─── Perfil 1: mujer, perder peso, sedentaria, objetivo cercano ───
console.log('\n1) Mujer 30 · 165cm · 70kg → 68kg · sedentaria · perder_peso');
const p1 = generatePersonalizedPlan({
  age: 30, sex: 'mujer', weight_kg: 70, height_cm: 165, target_weight_kg: 68,
  goal: 'perder_peso', activity_level: 'sedentario', dietary_preference: 'omnivoro',
  health_conditions: [], training_experience: 'principiante',
  training_days_per_week: 3, training_equipment: 'casa',
});
check('Calorías ≥ suelo 1200', p1.daily_calories >= 1200, `${p1.daily_calories}`);
check('Calorías ≤ 1800 (déficit moderado por objetivo cercano)', p1.daily_calories <= 1800, `${p1.daily_calories}`);
check('Macros cuadran con kcal', Math.abs(p1.protein_g * 4 + p1.carbs_g * 4 + p1.fat_g * 9 - p1.daily_calories) < 60);
const porcionComida1 = parseInt(p1.weekly_menu.Lunes.comida.ingredientes[0].match(/(\d+)g/)[1]);
check('Porción comida escalada (~115g, no 150g fijo)', porcionComida1 <= 120 && porcionComida1 >= 95, `${porcionComida1}g`);

// ─── Perfil 2: hombre, ganar masa, muy activo → tope calórico ───
console.log('\n2) Hombre 25 · 180cm · 85kg · muy_activo · ganar_masa');
const p2 = generatePersonalizedPlan({
  age: 25, sex: 'hombre', weight_kg: 85, height_cm: 180, target_weight_kg: null,
  goal: 'ganar_masa', activity_level: 'muy_activo', dietary_preference: 'omnivoro',
  health_conditions: [], training_experience: 'intermedio',
  training_days_per_week: 4, training_equipment: 'gimnasio',
});
check('Calorías tope 3500 (no 4100 sin control)', p2.daily_calories === 3500, `${p2.daily_calories}`);
check('4 sesiones de gimnasio', p2.training_plan.sesiones.length === 4, `${p2.training_plan.sesiones.length}`);
check('Sesiones repartidas (no solo las 4 primeras)', p2.training_plan.sesiones.some(s => s.dia === 'Jueves') && p2.training_plan.sesiones[0].dia === 'Lunes', JSON.stringify(p2.training_plan.sesiones.map(s => s.dia)));
check('Progresión incluida', Array.isArray(p2.training_plan.progresion) && p2.training_plan.progresion.length >= 3);

// ─── Perfil 3: diabetes + hipertensión ───
console.log('\n3) Hombre 45 · 170cm · 90kg · diabetes + hipertensión · perder_peso');
const p3 = generatePersonalizedPlan({
  age: 45, sex: 'hombre', weight_kg: 90, height_cm: 170, target_weight_kg: 80,
  goal: 'perder_peso', activity_level: 'ligero', dietary_preference: 'omnivoro',
  health_conditions: ['diabetes', 'hipertension'], training_experience: 'principiante',
  training_days_per_week: 3, training_equipment: 'casa',
});
check('Nota de diabetes en dieta', p3.notas_dieta.some(n => n.includes('Diabetes')), JSON.stringify(p3.notas_dieta));
check('Nota de hipertensión en dieta', p3.notas_dieta.some(n => n.includes('Hipertensión')));
check('Sin patata/boniato en el menú (diabetes)', !JSON.stringify(p3.weekly_menu).includes('Patata'));
check('Nota de diabetes en entrenamiento', p3.training_plan.notas.some(n => n.includes('glucemia')));
check('Aviso médico de diabetes en suplementos', p3.consejos_generales.some(n => n.includes('diabetes')));

// ─── Perfil 4: vegano + celiaquía ───
console.log('\n4) Mujer 22 · 168cm · 60kg · vegana + celiaquía · mantener');
const p4 = generatePersonalizedPlan({
  age: 22, sex: 'mujer', weight_kg: 60, height_cm: 168, target_weight_kg: null,
  goal: 'mantener', activity_level: 'moderado', dietary_preference: 'vegano',
  health_conditions: ['celiaquia'], training_experience: 'principiante',
  training_days_per_week: 3, training_equipment: 'mixto',
});
const menu4 = JSON.stringify(p4.weekly_menu);
check('Celiaquía fuerza base sin gluten', !menu4.includes('Pan integral') && !menu4.includes('Pasta integral'));
check('Sin productos animales (vegano)', !menu4.includes('Huevos') && !menu4.includes('Salmón') && !menu4.includes('Pollo'));
check('Suplementos veganos: B12', p4.supplements.some(s => s.nombre.includes('B12')));

// ─── Perfil 5: casa + ganar_masa intermedio → variantes caseras ───
console.log('\n5) Hombre 28 · 175cm · 70kg · casa · ganar_masa · intermedio · 3 días');
const p5 = generatePersonalizedPlan({
  age: 28, sex: 'hombre', weight_kg: 70, height_cm: 175, target_weight_kg: 75,
  goal: 'ganar_masa', activity_level: 'moderado', dietary_preference: 'omnivoro',
  health_conditions: [], training_experience: 'intermedio',
  training_days_per_week: 3, training_equipment: 'casa',
});
const ej5 = JSON.stringify(p5.training_plan.sesiones.map(s => s.ejercicios));
const maquinas = ['Prensa', 'Jalón', 'Hack', 'Cuerda tríceps', 'barra', 'polea', 'TRX', 'Kettlebell'];
check('3 sesiones disponibles en casa', p5.training_plan.sesiones.length === 3, `${p5.training_plan.sesiones.length}`);
check('Sin ejercicios de máquina en casa', !maquinas.some(m => ej5.includes(m)), ej5);
check('Equipamiento reflejado', p5.training_plan.equipamiento === 'casa');

// ─── Perfil 6: sin suplementos médicos en ningún caso ───
console.log('\n6) Suplementos limpios (sin dosis para patologías)');
const nombresSups = [...p3.supplements, ...p5.supplements].map(s => s.nombre).join(' ');
check('Sin berberina', !nombresSups.includes('Berberina'));
check('Sin L-Carnitina', !nombresSups.includes('L-Carnitina'));
check('Sin magnesio para hipertensión', !nombresSups.includes('Magnesio glicinato'));
check('Disclaimer presente', p3.consejos_generales.some(n => n.includes('orientativos')));

// ─── Perfil 7: adolescente → suelo calórico elevado ───
console.log('\n7) Chica 16 · 160cm · 60kg · sedentaria · perder_peso');
const p7 = generatePersonalizedPlan({
  age: 16, sex: 'mujer', weight_kg: 60, height_cm: 160, target_weight_kg: null,
  goal: 'perder_peso', activity_level: 'sedentario', dietary_preference: 'omnivoro',
  health_conditions: [], training_experience: 'principiante',
  training_days_per_week: 3, training_equipment: 'casa',
});
check('Suelo adolescente 1600 (no 1200)', p7.daily_calories >= 1600, `${p7.daily_calories}`);

// ─── Perfil 8: coherencia título ↔ ingredientes (bug de doble pick) ───
console.log('\n8) Coherencia título ↔ ingredientes en TODOS los planes');
function stripGrams(s) {
  return String(s).replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
}
function titleHas(plan, day, meal, idx) {
  const title = plan.weekly_menu[day][meal].nombre.toLowerCase();
  const ing = stripGrams(plan.weekly_menu[day][meal].ingredientes[idx]);
  return title.includes(ing);
}
let incoherentes = [];
[p1, p2, p3, p4, p5, p7].forEach((p, pi) => {
  Object.keys(p.weekly_menu).forEach(day => {
    const m = p.weekly_menu[day];
    if (!titleHas(p, day, 'desayuno', 0) || !titleHas(p, day, 'desayuno', 1)) incoherentes.push(`P${pi + 1} ${day} desayuno`);
    if (!titleHas(p, day, 'almuerzo', 0)) incoherentes.push(`P${pi + 1} ${day} almuerzo`);
    if (!titleHas(p, day, 'comida', 0) || !titleHas(p, day, 'comida', 1) || !titleHas(p, day, 'comida', 2)) incoherentes.push(`P${pi + 1} ${day} comida`);
    if (!titleHas(p, day, 'merienda', 0)) incoherentes.push(`P${pi + 1} ${day} merienda`);
    if (!titleHas(p, day, 'cena', 0) || !titleHas(p, day, 'cena', 1)) incoherentes.push(`P${pi + 1} ${day} cena`);
    // Desayuno/merienda nunca con aceite en el título
    if (m.desayuno.nombre.toLowerCase().includes('aceite')) incoherentes.push(`P${pi + 1} ${day} desayuno-aceite`);
    if (m.merienda.nombre.toLowerCase().includes('aceite')) incoherentes.push(`P${pi + 1} ${day} merienda-aceite`);
  });
});
check('Título e ingredientes coherentes en 6 planes × 7 días', incoherentes.length === 0, incoherentes.slice(0, 10).join(', '));

console.log(failures === 0 ? '\n🎉 TODAS LAS COMPROBACIONES OK' : `\n❌ ${failures} comprobaciones fallidas`);
process.exit(failures === 0 ? 0 : 1);
