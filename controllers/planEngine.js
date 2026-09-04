/**
 * Vytal — Motor de Planes Personalizados
 * Calcula el plan de nutrición y entrenamiento basado en el cuestionario.
 *
 * Principios de diseño:
 *  - Las calorías y macros se calculan con ecuaciones reconocidas (Harris-Benedict revisada)
 *    y se acotan a rangos seguros (nunca por debajo del suelo calórico ni por encima del tope).
 *  - Las porciones del menú escalan con el objetivo calórico (referencia: ~2000 kcal/día),
 *    de modo que el menú es coherente con las kcal que se muestran.
 *  - Las condiciones de salud adaptan la dieta (no solo la suplementación).
 *  - Los suplementos no incluyen dosis para patologías: solo orientación general y avisos.
 *  - El entrenamiento respeta el equipamiento disponible (casa/gimnasio/mixto) y el nivel,
 *    e incluye progresión semana a semana.
 */

// ─── Constantes de macros por objetivo ──────────────────────
const MACRO_RATIOS = {
    perder_peso: { protein: 0.35, carbs: 0.35, fat: 0.30 },
    ganar_masa: { protein: 0.30, carbs: 0.50, fat: 0.20 },
    mantener: { protein: 0.25, carbs: 0.50, fat: 0.25 },
    mejorar_salud: { protein: 0.25, carbs: 0.45, fat: 0.30 },
};

// ─── Multiplicadores de actividad (TDEE) ────────────────────
const ACTIVITY_MULTIPLIERS = {
    sedentario: 1.2,
    ligero: 1.375,
    moderado: 1.55,
    activo: 1.725,
    muy_activo: 1.9,
};

// ─── Ajuste calórico base por objetivo ──────────────────────
const CALORIE_ADJUSTMENTS = {
    perder_peso: -500,
    ganar_masa: 400,
    mantener: 0,
    mejorar_salud: -200,
};

// ─── Suelos y topes calóricos de seguridad (kcal/día) ───────
// Un déficit más agresivo que estos suelos no es defendible ni seguro.
const SAFE_MIN_CALORIES = { hombre: 1500, mujer: 1200 };
const SAFE_MIN_CALORIES_ADOLESCENT = { hombre: 1800, mujer: 1600 }; // < 18 años
const SAFE_MAX_CALORIES = 3500;

/**
 * TMB (Tasa Metabólica Basal) — Ecuación de Harris-Benedict revisada
 */
function calculateBMR(sex, weight, height, age) {
    if (sex === 'hombre') {
        return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
    }
    return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
}

/**
 * Ajuste calórico según objetivo, usando el peso objetivo si se indica.
 * El déficit/superávit se modera cuando la distancia al peso objetivo es pequeña,
 * y nunca supera los ±500 kcal.
 */
function calorieAdjustment(goal, weightKg, targetKg) {
    let adj = CALORIE_ADJUSTMENTS[goal];

    if (goal === 'perder_peso' && targetKg && targetKg < weightKg) {
        const excess = weightKg - targetKg;
        adj = -Math.round(Math.min(500, Math.max(250, excess * 50)));
    } else if (goal === 'ganar_masa' && targetKg && targetKg > weightKg) {
        const gap = targetKg - weightKg;
        adj = Math.round(Math.min(500, Math.max(200, gap * 40)));
    }
    return adj;
}

/**
 * Calcula las calorías diarias y distribución de macros.
 * Aplica suelo/tope de seguridad y recalcula los macros sobre el valor final.
 */
function calculateNutrition(answers) {
    const { sex, weight_kg, height_cm, age, goal, activity_level, target_weight_kg } = answers;
    const bmr = calculateBMR(sex, weight_kg, height_cm, age);
    const tdee = bmr * ACTIVITY_MULTIPLIERS[activity_level];
    let dailyCalories = Math.round(tdee + calorieAdjustment(goal, weight_kg, target_weight_kg));

    const baseFloor = SAFE_MIN_CALORIES[sex] || 1200;
    const floor = age < 18 ? (SAFE_MIN_CALORIES_ADOLESCENT[sex] || baseFloor) : baseFloor;
    dailyCalories = Math.min(SAFE_MAX_CALORIES, Math.max(floor, dailyCalories));

    const ratios = MACRO_RATIOS[goal];
    return {
        daily_calories: dailyCalories,
        protein_g: Math.round((dailyCalories * ratios.protein) / 4),
        carbs_g: Math.round((dailyCalories * ratios.carbs) / 4),
        fat_g: Math.round((dailyCalories * ratios.fat) / 9),
    };
}

// ─── Bases de alimentos por preferencia ─────────────────────
const FOOD_BASES = {
    omnivoro: {
        proteins: ['Pechuga de pollo', 'Salmón', 'Atún al natural', 'Huevos', 'Ternera magra', 'Pavo', 'Sardinas'],
        carbs: ['Arroz integral', 'Avena', 'Patata', 'Quinoa', 'Pan integral', 'Pasta integral', 'Boniato'],
        fats: ['Aguacate', 'Aceite de oliva virgen', 'Frutos secos', 'Semillas de chía'],
        vegs: ['Brócoli', 'Espinacas', 'Pimiento', 'Calabacín', 'Tomate', 'Lechuga', 'Pepino', 'Col rizada'],
    },
    vegetariano: {
        proteins: ['Huevos', 'Queso fresco', 'Yogur griego', 'Lentejas', 'Garbanzos', 'Tofu', 'Tempeh'],
        carbs: ['Arroz integral', 'Avena', 'Quinoa', 'Pan integral', 'Pasta integral', 'Boniato'],
        fats: ['Aguacate', 'Aceite de oliva virgen', 'Almendras', 'Nueces', 'Mantequilla de cacahuete'],
        vegs: ['Brócoli', 'Espinacas', 'Pimiento', 'Calabacín', 'Tomate', 'Champiñones', 'Berenjena'],
    },
    vegano: {
        proteins: ['Tofu firme', 'Tempeh', 'Edamame', 'Lentejas', 'Garbanzos', 'Alubias negras', 'Seitán'],
        carbs: ['Arroz integral', 'Avena', 'Quinoa', 'Pan integral', 'Boniato', 'Maíz'],
        fats: ['Aguacate', 'Aceite de oliva', 'Nueces', 'Semillas de lino', 'Mantequilla de almendras'],
        vegs: ['Brócoli', 'Espinacas', 'Kale', 'Pimiento', 'Calabacín', 'Tomate', 'Champiñones'],
    },
    sin_gluten: {
        proteins: ['Pechuga de pollo', 'Salmón', 'Huevos', 'Ternera', 'Atún', 'Gambas'],
        carbs: ['Arroz integral', 'Boniato', 'Patata', 'Quinoa', 'Maíz', 'Avena certificada sin gluten'],
        fats: ['Aguacate', 'Aceite de oliva', 'Frutos secos', 'Semillas de chía'],
        vegs: ['Brócoli', 'Espinacas', 'Pimiento', 'Calabacín', 'Tomate', 'Zanahoria'],
    },
    sin_lactosa: {
        proteins: ['Pechuga de pollo', 'Salmón', 'Huevos', 'Ternera', 'Atún', 'Garbanzos'],
        carbs: ['Arroz integral', 'Avena', 'Quinoa', 'Pan sin lactosa', 'Boniato', 'Pasta'],
        fats: ['Aceite de oliva', 'Aguacate', 'Frutos secos', 'Aceite de coco'],
        vegs: ['Brócoli', 'Espinacas', 'Pimiento', 'Calabacín', 'Espárragos', 'Tomate'],
    },
};

// ─── Reglas dietéticas por condición de salud ────────────────
// Excluyen alimentos y aportan notas concretas. No sustituyen consejo médico.
const HEALTH_DIET_RULES = {
    diabetes: {
        excludeCarbs: ['Patata', 'Boniato'],
        note: '🩸 Diabetes: prioriza hidratos de absorción lenta (integrales, legumbres, quinoa) y controla las raciones. Evita azúcares añadidos.',
    },
    hipertension: {
        note: '💉 Hipertensión: reduce la sal añadida y los alimentos procesados; usa hierbas y especias para condimentar.',
    },
    colesterol: {
        excludeProteins: ['Ternera magra', 'Ternera'],
        note: '🫀 Colesterol alto: prioriza pescado azul, aves sin piel y legumbres; limita las carnes rojas y las grasas saturadas.',
    },
    hipotiroidismo: {
        note: '🦋 Hipotiroidismo: asegura un aporte adecuado de yodo y selenio (pescado, lácteos, huevos, frutos secos). Consulta a tu médico al cambiar de peso, puede requerir ajuste de medicación.',
    },
    celiaquia: {
        note: '🌾 Celiaquía: menú 100% sin gluten (usa avena certificada y evita contaminación cruzada).',
    },
};

// Exclusión de hidratos con gluten por base de alimentos (para la celiaquía).
// Así un vegano/vegetariano con celiaquía conserva su base vegetal en lugar de
// saltar a la base sin gluten estándar (que incluye carnes y pescados).
const GLUTEN_FREE_CARB_EXCLUSIONS = {
    omnivoro: ['Avena', 'Pan integral', 'Pasta integral'],
    vegetariano: ['Avena', 'Pan integral', 'Pasta integral'],
    vegano: ['Avena', 'Pan integral'],
    sin_lactosa: ['Avena', 'Pan sin lactosa', 'Pasta'],
    sin_gluten: [],
};

// Días de la semana
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Resuelve la base de alimentos del usuario (sin forzar cambios de base).
 */
function resolveDietBase(preference) {
    return preference in FOOD_BASES ? preference : 'omnivoro';
}

/**
 * Aplica las reglas de salud sobre la base de alimentos y devuelve las notas.
 */
function applyHealthRules(diet, conditions) {
    let foods = FOOD_BASES[diet];
    const notas = [];

    conditions.forEach(cond => {
        const rule = HEALTH_DIET_RULES[cond];
        if (!rule) return;
        if (rule.note) notas.push(rule.note);

        if (rule.excludeCarbs && foods.carbs) {
            foods = { ...foods, carbs: foods.carbs.filter(c => !rule.excludeCarbs.includes(c)) };
        }
        if (rule.excludeProteins && foods.proteins) {
            foods = { ...foods, proteins: foods.proteins.filter(p => !rule.excludeProteins.includes(p)) };
        }
    });

    // Celiaquía: excluye los hidratos con gluten de la base del usuario
    // (sin cambiar la base, para no introducir carnes en dietas plant-based).
    if (conditions.includes('celiaquia')) {
        const exclusions = GLUTEN_FREE_CARB_EXCLUSIONS[diet] || [];
        if (exclusions.length && foods.carbs) {
            foods = { ...foods, carbs: foods.carbs.filter(c => !exclusions.includes(c)) };
        }
    }

    return { foods, notas };
}

/**
 * Escala una cantidad de referencia (calculada para ~2000 kcal/día)
 * al objetivo calórico real del usuario.
 */
function scaleGrams(baseGrams, factor, min = 50) {
    const scaled = Math.round((baseGrams * factor) / 5) * 5;
    return Math.max(min, scaled);
}

/**
 * Genera un menú semanal personalizado con porciones coherentes con las kcal.
 */
function generateWeeklyMenu(answers, macros) {
    const conditions = (answers.health_conditions || []).filter(c => c !== 'ninguna');
    const diet = resolveDietBase(answers.dietary_preference);
    const { foods, notas } = applyHealthRules(diet, conditions);
    // Desayuno: usa avena si la base la permite (certificada sin gluten en celiaquía),
    // si no, un hidrato de la base del usuario.
    const carbForBreakfast = foods.carbs.find(c => c.startsWith('Avena')) || foods.carbs[0];
    const breakfastName = carbForBreakfast.startsWith('Avena') ? 'Avena' : carbForBreakfast;
    const cals = macros.daily_calories;

    // Factor de porciones: las cantidades base están pensadas para ~2000 kcal
    const factor = Math.min(1.4, Math.max(0.7, cals / 2000));

    // Distribución de calorías por comida
    const dist = { desayuno: 0.25, almuerzo: 0.10, comida: 0.35, merienda: 0.10, cena: 0.20 };

    const menu = {};
    DAYS.forEach(day => {
        // Cada componente se elige UNA sola vez y se reutiliza en el título y en
        // los ingredientes, para que nunca se contradigan (bug: antes cada pick()
        // era independiente y el título podía decir "Salmón" con pollo dentro).
        // Para desayuno y merienda se evitan los aceites (frutos secos, semillas,
        // mantequillas de frutos secos y aguacate funcionan mejor con avena/fruta).
        const solidFats = foods.fats.filter(f => !f.startsWith('Aceite'));
        const desFat = pick(solidFats.length ? solidFats : foods.fats);
        const snackProtein = pick(foods.proteins);
        const lunchProtein = pick(foods.proteins);
        const lunchCarb = pick(foods.carbs);
        const lunchVeg = pick(foods.vegs);
        const snackFat = pick(solidFats.length ? solidFats : foods.fats);
        const dinnerProtein = pick(foods.proteins);
        const dinnerVeg = pick(foods.vegs);

        menu[day] = {
            desayuno: {
                nombre: `${breakfastName} con ${desFat} y fruta`,
                calorias: Math.round(cals * dist.desayuno),
                ingredientes: [`${carbForBreakfast} (${scaleGrams(70, factor, 40)}g)`, `${desFat}`, 'Plátano o frutos rojos', 'Leche vegetal o agua'],
            },
            almuerzo: {
                nombre: `Snack de ${snackProtein}`,
                calorias: Math.round(cals * dist.almuerzo),
                ingredientes: [`${snackProtein} (${scaleGrams(30, factor, 20)}g)`, 'Fruta de temporada'],
            },
            comida: {
                nombre: `${lunchProtein} con ${lunchCarb} y ${lunchVeg}`,
                calorias: Math.round(cals * dist.comida),
                ingredientes: [
                    `${lunchProtein} (${scaleGrams(150, factor, 100)}g)`,
                    `${lunchCarb} (${scaleGrams(100, factor, 60)}g en crudo)`,
                    `${lunchVeg} (${scaleGrams(200, factor, 120)}g)`,
                    'Aceite de oliva (1 cucharada)',
                ],
            },
            merienda: {
                nombre: `${snackFat} con fruta`,
                calorias: Math.round(cals * dist.merienda),
                ingredientes: [`${snackFat} (${scaleGrams(25, factor, 15)}g)`, 'Manzana o pera'],
            },
            cena: {
                nombre: `${dinnerProtein} con ${dinnerVeg} al horno`,
                calorias: Math.round(cals * dist.cena),
                ingredientes: [
                    `${dinnerProtein} (${scaleGrams(130, factor, 80)}g)`,
                    `${dinnerVeg} (${scaleGrams(250, factor, 150)}g)`,
                    'Aceite de oliva virgen (1 cucharada)',
                    'Especias al gusto',
                ],
            },
        };
    });
    return { menu, notas_dieta: notas };
}

// ─── Planes de entrenamiento ─────────────────────────────────
// Cada sesión indica el equipamiento que requiere:
//   casa    → solo con el peso corporal, gomas o mancuernas
//   gimnasio → requiere máquinas o barras de gimnasio
//   mixto   → funciona en ambos entornos
// Las sesiones de gimnasio incluyen ejercicios_casa como alternativa real.
const TRAINING_PLANS = {
    perder_peso: {
        principiante: [
            { dia: 'Lunes', tipo: 'Cardio moderado', equipo: 'casa', ejercicios: ['Caminata rápida 30 min', 'Sentadillas 3x12', 'Fondos 3x8', 'Plancha 3x30s'] },
            { dia: 'Miércoles', tipo: 'Full Body', equipo: 'casa', ejercicios: ['Burpees 3x10', 'Zancadas 3x12', 'Remo con goma 3x12', 'Abdominales 3x15'] },
            { dia: 'Viernes', tipo: 'HIIT ligero', equipo: 'casa', ejercicios: ['Jumping jacks 4x30s', 'Mountain climbers 4x30s', 'Sentadillas sumo 3x15', 'Puente glúteo 3x15'] },
        ],
        intermedio: [
            { dia: 'Lunes', tipo: 'Tren inferior + cardio', equipo: 'gimnasio',
                ejercicios: ['Sentadillas 4x15', 'Peso muerto rumano 4x12', 'Prensa 3x15', 'HIIT 15 min'],
                ejercicios_casa: ['Sentadillas 4x15', 'Peso muerto rumano con mancuernas 4x12', 'Zancadas con mancuernas 3x12', 'HIIT 15 min'] },
            { dia: 'Martes', tipo: 'Tren superior', equipo: 'gimnasio',
                ejercicios: ['Press banca 4x12', 'Remo barra 4x12', 'Press militar 3x10', 'Curl biceps 3x12'],
                ejercicios_casa: ['Flexiones 4x12', 'Remo con goma 4x12', 'Press militar con mancuernas 3x10', 'Curl biceps con mancuernas 3x12'] },
            { dia: 'Jueves', tipo: 'HIIT + core', equipo: 'casa', ejercicios: ['HIIT 20 min', 'Plancha lateral 3x45s', 'Rueda abdominal 3x8', 'Hipopresivos 3x1min'] },
            { dia: 'Sábado', tipo: 'Full Body', equipo: 'mixto', ejercicios: ['Sentadilla búlgara 4x10', 'Dominadas 3x8', 'Fondos 3x10', 'Cardio 20 min'] },
        ],
        avanzado: [
            { dia: 'Lunes', tipo: 'Piernas', equipo: 'gimnasio',
                ejercicios: ['Sentadilla con barra 5x8', 'Peso muerto 4x6', 'Hack squat 4x12', 'Extensión isquio 4x12', 'Gemelos 4x15'],
                ejercicios_casa: ['Sentadilla con mancuernas 5x12', 'Peso muerto rumano con mancuernas 4x10', 'Zancadas caminando 4x15', 'Puente glúteo a una pierna 4x12', 'Gemelos de pie 4x20'] },
            { dia: 'Martes', tipo: 'Pecho + Tríceps', equipo: 'gimnasio',
                ejercicios: ['Press banca 5x6', 'Press inclinado 4x10', 'Aperturas 3x12', 'Fondos 4x10', 'Cuerda tríceps 4x12'],
                ejercicios_casa: ['Flexiones declinadas 5x12', 'Flexiones inclinadas 4x15', 'Aperturas con mancuernas 3x12', 'Fondos entre sillas 4x12', 'Extensión de tríceps con mancuerna 4x12'] },
            { dia: 'Miércoles', tipo: 'HIIT + cardio', equipo: 'casa', ejercicios: ['HIIT sprint 25 min', 'Core intensivo 15 min'] },
            { dia: 'Jueves', tipo: 'Espalda + Bíceps', equipo: 'gimnasio',
                ejercicios: ['Dominadas 5x6', 'Remo barra 4x8', 'Jalón 4x10', 'Curl martillo 4x12'],
                ejercicios_casa: ['Dominadas o remo invertido 5x8', 'Remo con goma 4x12', 'Remo con mancuerna 4x10', 'Curl martillo con mancuernas 4x12'] },
            { dia: 'Viernes', tipo: 'Hombros + Core', equipo: 'gimnasio',
                ejercicios: ['Press militar 4x8', 'Elevaciones laterales 4x12', 'Pájaro 4x12', 'Plancha 4x1min', 'Rueda abdominal 4x10'],
                ejercicios_casa: ['Press militar con mancuernas 4x10', 'Elevaciones laterales con mancuernas 4x12', 'Pájaro con mancuernas 4x12', 'Plancha 4x1min', 'Mountain climbers 4x30s'] },
        ],
    },

    ganar_masa: {
        principiante: [
            { dia: 'Lunes', tipo: 'Tren superior A', equipo: 'casa', ejercicios: ['Press banca con mancuernas 3x8', 'Remo con mancuerna 3x10', 'Curl biceps 3x10', 'Press francés 3x10'] },
            { dia: 'Miércoles', tipo: 'Tren inferior', equipo: 'casa', ejercicios: ['Sentadillas 3x8', 'Peso muerto rumano con mancuernas 3x6', 'Zancadas 3x10', 'Puente glúteo 3x15'] },
            { dia: 'Viernes', tipo: 'Tren superior B', equipo: 'gimnasio',
                ejercicios: ['Press inclinado 3x8', 'Jalón polea 3x10', 'Press militar 3x8', 'Fondos 3x8'],
                ejercicios_casa: ['Flexiones 3x10', 'Remo con goma 3x12', 'Press militar con mancuernas 3x8', 'Fondos entre sillas 3x10'] },
        ],
        intermedio: [
            { dia: 'Lunes', tipo: 'Pecho + Bíceps', equipo: 'gimnasio',
                ejercicios: ['Press banca 4x8', 'Aperturas 3x12', 'Press inclinado 4x10', 'Curl barra 4x10', 'Curl martillo 3x12'],
                ejercicios_casa: ['Flexiones con peso 4x10', 'Aperturas con mancuernas 3x12', 'Press inclinado con mancuernas 4x10', 'Curl biceps con mancuernas 4x10', 'Curl martillo 3x12'] },
            { dia: 'Martes', tipo: 'Espalda + Tríceps', equipo: 'gimnasio',
                ejercicios: ['Dominadas 4x6', 'Remo barra 4x8', 'Jalón 3x12', 'Cuerda tríceps 4x12', 'Fondos 3x10'],
                ejercicios_casa: ['Dominadas o remo invertido 4x8', 'Remo con goma 4x12', 'Remo con mancuerna 3x10', 'Extensión tríceps con mancuerna 4x12', 'Fondos entre sillas 3x12'] },
            { dia: 'Jueves', tipo: 'Piernas', equipo: 'gimnasio',
                ejercicios: ['Sentadilla 4x8', 'Peso muerto rumano 4x10', 'Prensa 4x12', 'Curl isquio 4x12', 'Gemelos 4x15'],
                ejercicios_casa: ['Sentadilla con mancuernas 4x12', 'Peso muerto rumano con mancuernas 4x10', 'Zancadas con mancuernas 4x12', 'Curl femoral tumbado con goma 4x12', 'Gemelos de pie 4x20'] },
            { dia: 'Viernes', tipo: 'Hombros + Trapecios', equipo: 'gimnasio',
                ejercicios: ['Press militar 4x8', 'Elevaciones 4x12', 'Pájaro 4x12', 'Encogimientos 4x12'],
                ejercicios_casa: ['Press militar con mancuernas 4x10', 'Elevaciones laterales 4x12', 'Pájaro con mancuernas 4x12', 'Encogimientos con mancuernas 4x15'] },
        ],
        avanzado: [
            { dia: 'Lunes', tipo: 'Pecho', equipo: 'gimnasio',
                ejercicios: ['Press banca 5x5', 'Press inclinado 4x8', 'Aperturas 4x12', 'Pullover 3x12', 'Dips lastrados 4x8'],
                ejercicios_casa: ['Flexiones con peso 5x10', 'Press inclinado con mancuernas 4x10', 'Aperturas con mancuernas 4x12', 'Pullover con mancuerna 3x12', 'Fondos entre sillas con peso 4x10'] },
            { dia: 'Martes', tipo: 'Espalda', equipo: 'gimnasio',
                ejercicios: ['Peso muerto 5x4', 'Dominadas lastradas 4x6', 'Remo cable 4x10', 'Jalón trasnuca 3x10', 'Pull-over 3x12'],
                ejercicios_casa: ['Peso muerto rumano con mancuernas 5x8', 'Dominadas o remo invertido 4x10', 'Remo con goma 4x12', 'Remo con mancuerna 3x10', 'Pull-over con mancuerna 3x12'] },
            { dia: 'Miércoles', tipo: 'Hombros', equipo: 'gimnasio',
                ejercicios: ['Press militar 5x6', 'Elevaciones laterales 5x12', 'Pájaro 4x12', 'Face pull 4x15', 'Encogimientos 4x12'],
                ejercicios_casa: ['Press militar con mancuernas 5x8', 'Elevaciones laterales 5x12', 'Pájaro con mancuernas 4x12', 'Remo al mentón con goma 4x15', 'Encogimientos con mancuernas 4x15'] },
            { dia: 'Jueves', tipo: 'Piernas', equipo: 'gimnasio',
                ejercicios: ['Sentadilla 5x5', 'Hack squat 4x10', 'Prensa 4x12', 'Curl isquio 4x12', 'Extensión cuádriceps 4x12', 'Gemelos 5x15'],
                ejercicios_casa: ['Sentadilla con mancuernas 5x12', 'Sentadilla búlgara 4x12', 'Zancadas caminando 4x15', 'Curl femoral con goma 4x12', 'Sentadilla isométrica 4x45s', 'Gemelos de pie 5x20'] },
            { dia: 'Viernes', tipo: 'Brazos', equipo: 'gimnasio',
                ejercicios: ['Curl barra Z 5x10', 'Curl martillo 4x12', 'Cuerda tríceps 5x12', 'Fondos 4x10', 'Extensión sobre cabeza 4x12'],
                ejercicios_casa: ['Curl biceps con mancuernas 5x10', 'Curl martillo 4x12', 'Extensión tríceps con mancuerna 5x12', 'Fondos entre sillas 4x12', 'Extensión sobre cabeza con mancuerna 4x12'] },
        ],
    },

    mantener: {
        principiante: [
            { dia: 'Lunes', tipo: 'Full Body', equipo: 'casa', ejercicios: ['Sentadillas 3x12', 'Fondos 3x10', 'Remo con goma 3x12', 'Plancha 3x30s', 'Caminata 20 min'] },
            { dia: 'Miércoles', tipo: 'Cardio + flexibilidad', equipo: 'casa', ejercicios: ['Bici o elíptica 30 min', 'Yoga o estiramientos 20 min'] },
            { dia: 'Viernes', tipo: 'Full Body', equipo: 'casa', ejercicios: ['Peso muerto rumano con mancuernas 3x10', 'Press militar con mancuernas 3x10', 'Zancadas 3x12', 'Plancha lateral 3x30s'] },
        ],
        intermedio: [
            { dia: 'Lunes', tipo: 'Tren superior', equipo: 'gimnasio',
                ejercicios: ['Press banca 4x10', 'Remo barra 4x10', 'Press militar 3x10', 'Curl/Tríceps 3x12'],
                ejercicios_casa: ['Flexiones 4x12', 'Remo con goma 4x12', 'Press militar con mancuernas 3x10', 'Curl y extensión con mancuernas 3x12'] },
            { dia: 'Miércoles', tipo: 'Tren inferior', equipo: 'gimnasio',
                ejercicios: ['Sentadilla 4x10', 'Peso muerto rumano 3x8', 'Zancadas 3x12', 'Puente glúteo 3x15'],
                ejercicios_casa: ['Sentadilla con mancuernas 4x12', 'Peso muerto rumano con mancuernas 3x10', 'Zancadas 3x12', 'Puente glúteo 3x15'] },
            { dia: 'Viernes', tipo: 'Cardio + core', equipo: 'casa', ejercicios: ['Cardio 30 min', 'Plancha 3x1min', 'Abdominales 3x20', 'Hipopresivos 3x1min'] },
        ],
        avanzado: [
            { dia: 'Lunes', tipo: 'Empuje', equipo: 'gimnasio',
                ejercicios: ['Press banca 4x8', 'Press inclinado 4x10', 'Press militar 4x8', 'Tríceps 4x12'],
                ejercicios_casa: ['Flexiones con peso 4x10', 'Press inclinado con mancuernas 4x10', 'Press militar con mancuernas 4x10', 'Extensión tríceps con mancuerna 4x12'] },
            { dia: 'Martes', tipo: 'Tirón', equipo: 'gimnasio',
                ejercicios: ['Dominadas 4x8', 'Remo barra 4x8', 'Jalón 4x10', 'Bíceps 4x12'],
                ejercicios_casa: ['Dominadas o remo invertido 4x10', 'Remo con goma 4x12', 'Remo con mancuerna 4x10', 'Curl biceps con mancuernas 4x12'] },
            { dia: 'Jueves', tipo: 'Piernas', equipo: 'gimnasio',
                ejercicios: ['Sentadilla 4x8', 'Peso muerto 4x6', 'Prensa 4x12', 'Gemelos 4x15'],
                ejercicios_casa: ['Sentadilla con mancuernas 4x12', 'Peso muerto rumano con mancuernas 4x10', 'Zancadas con mancuernas 4x12', 'Gemelos de pie 4x20'] },
            { dia: 'Sábado', tipo: 'Cardio + movilidad', equipo: 'casa', ejercicios: ['Cardio 40 min', 'Movilidad articular 20 min'] },
        ],
    },

    mejorar_salud: {
        principiante: [
            { dia: 'Lunes', tipo: 'Cardio suave', equipo: 'casa', ejercicios: ['Caminata 30 min', 'Estiramientos 15 min'] },
            { dia: 'Miércoles', tipo: 'Fuerza funcional', equipo: 'casa', ejercicios: ['Sentadillas 3x10', 'Puente glúteo 3x12', 'Plancha 3x20s', 'Rotaciones 3x10'] },
            { dia: 'Viernes', tipo: 'Yoga o pilates', equipo: 'casa', ejercicios: ['Sesión guiada 40 min'] },
        ],
        intermedio: [
            { dia: 'Lunes', tipo: 'Cardio moderado', equipo: 'casa', ejercicios: ['Bici o correr 30 min', 'Estiramientos 10 min'] },
            { dia: 'Miércoles', tipo: 'Fuerza', equipo: 'casa', ejercicios: ['Sentadillas 3x12', 'Fondos 3x10', 'Remo con goma 3x12', 'Plancha 3x45s'] },
            { dia: 'Viernes', tipo: 'Pilates + movilidad', equipo: 'casa', ejercicios: ['Pilates 30 min', 'Foam roller 15 min'] },
        ],
        avanzado: [
            { dia: 'Lunes', tipo: 'Cardio + fuerza', equipo: 'mixto', ejercicios: ['Carrera 5km', 'Circuito fuerza 3 rondas'] },
            { dia: 'Miércoles', tipo: 'Funcional', equipo: 'gimnasio',
                ejercicios: ['Kettlebell 30 min', 'TRX 20 min', 'Core 15 min'],
                ejercicios_casa: ['Mancuernas 30 min', 'Gomas elásticas 20 min', 'Core 15 min'] },
            { dia: 'Viernes', tipo: 'Recuperación activa', equipo: 'casa', ejercicios: ['Yoga 45 min', 'Estiramientos profundos 15 min'] },
        ],
    },
};

// ─── Progresión sugerida por nivel ───────────────────────────
const PROGRESSION_NOTES = {
    principiante: [
        'Semanas 1-2: domina la técnica con cargas ligeras.',
        'Semanas 3-4: añade 1-2 repeticiones por serie.',
        'Semana 5 en adelante: sube ligeramente el peso (5-10%) manteniendo la técnica.',
    ],
    intermedio: [
        'Semanas 1-2: usa una carga cómoda para reaclimatarte.',
        'Semanas 3-4: aumenta la carga un 5-10% o añade 1-2 repeticiones.',
        'Semana 5+: introduce una técnica de intensidad (p. ej. series descendentes) en el último ejercicio de cada sesión.',
    ],
    avanzado: [
        'Progresa con aumentos pequeños y controlados de carga (2.5-5 kg) cada 1-2 semanas.',
        'Cada 6-8 semanas, haz una semana de descarga (50-60% del volumen) para recuperar.',
        'Varía la selección de ejercicios cada 8-12 semanas para seguir progresando.',
    ],
};

/**
 * Notas de seguridad para el entrenamiento según condiciones de salud.
 */
function trainingHealthNotes(conditions) {
    const notes = [];
    conditions.forEach(c => {
        if (c === 'diabetes') notes.push('🩸 Diabetes: controla tu glucemia antes y después de entrenar y lleva carbohidratos de acción rápida por si hay hipoglucemia.');
        if (c === 'hipertension') notes.push('💉 Hipertensión: evita retener la respiración en esfuerzos máximos (maniobra de Valsalva); monitoriza tu tensión y consulta a tu médico.');
        if (c === 'colesterol') notes.push('🫀 Colesterol: combina fuerza con cardio moderado; el ejercicio aeróbico regular ayuda a mejorarlo.');
        if (c === 'hipotiroidismo') notes.push('🦋 Hipotiroidismo: la fatiga puede limitar el rendimiento; aumenta la intensidad de forma gradual.');
        if (c === 'celiaquia') notes.push('🌾 Celiaquía: no hay restricción para entrenar; prioriza la hidratación y la recuperación.');
    });
    return notes;
}

/**
 * Selecciona el plan de entrenamiento adecuado según objetivo, nivel,
 * días disponibles y equipamiento.
 */
function generateTrainingPlan(answers) {
    const { goal, training_experience, training_days_per_week, training_equipment = 'mixto', health_conditions = [] } = answers;
    const conditions = (health_conditions || []).filter(c => c !== 'ninguna');

    const goalKey = goal in TRAINING_PLANS ? goal : 'mantener';
    const level = training_experience in TRAINING_PLANS[goalKey] ? training_experience : 'principiante';
    const allSessions = TRAINING_PLANS[goalKey][level];

    // Filtrar por equipamiento disponible
    let pool;
    if (training_equipment === 'casa') {
        pool = allSessions.filter(s => s.equipo === 'casa' || s.ejercicios_casa);
    } else if (training_equipment === 'gimnasio') {
        pool = allSessions.filter(s => s.equipo !== 'casa');
    } else {
        pool = allSessions;
    }
    if (pool.length === 0) pool = allSessions;

    // Distribuir los días de forma equilibrada a lo largo de la semana.
    // Se respeta SIEMPRE el número de días solicitado por el usuario: si el pool
    // de plantillas es menor (ej. 4 plantillas y 6 días), las sesiones se repiten
    // en ciclo, como en los splits reales de 5-6 días.
    const requested = Math.max(1, training_days_per_week || 3);
    const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const selected = [];
    if (requested === 1) {
        selected.push(pool[0]);
    } else if (requested <= pool.length) {
        for (let i = 0; i < requested; i++) {
            const idx = Math.round((i * (pool.length - 1)) / (requested - 1));
            if (!selected.includes(pool[idx])) selected.push(pool[idx]);
        }
    } else {
        // Ciclar el pool, asignando cada repetición a un día distinto de la semana
        for (let i = 0; i < requested; i++) {
            const slot = Math.round((i * 6) / (requested - 1));
            const base = pool[i % pool.length];
            selected.push({ ...base, dia: weekDays[slot] });
        }
    }
    const days = selected.length;

    const sesiones = selected.map(s => ({
        dia: s.dia,
        tipo: s.tipo,
        // En casa usamos la variante con ejercicios realizables sin máquinas
        ejercicios: (training_equipment === 'casa' && s.ejercicios_casa) ? s.ejercicios_casa : s.ejercicios,
    }));

    return {
        nivel: level,
        objetivo: goalKey,
        dias_semana: days,
        equipamiento: training_equipment,
        sesiones,
        progresion: PROGRESSION_NOTES[level] || PROGRESSION_NOTES.principiante,
        notas: [
            'Calienta siempre 5-10 minutos antes de cada sesión.',
            'Descansa 60-90 segundos entre series.',
            'Hidratación: mínimo 2 litros de agua al día.',
            'Si sientes dolor agudo, para el ejercicio inmediatamente.',
            ...trainingHealthNotes(conditions),
        ],
    };
}

/**
 * Genera recomendaciones de suplementación prudentes.
 * Nunca se prescriben dosis para patologías: solo orientación general y avisos.
 */
function generateSupplements(answers) {
    const { goal, dietary_preference, health_conditions } = answers;
    const conditions = (health_conditions || []).filter(c => c !== 'ninguna');
    const supps = [];
    const notas = [];

    // Base siempre recomendada
    supps.push({ nombre: 'Multivitamínico completo', dosis: '1 cápsula al día con el desayuno', motivo: 'Cubre posibles déficits nutricionales' });

    if (goal === 'ganar_masa' || goal === 'mantener') {
        supps.push({ nombre: 'Proteína Whey (o vegana si eres vegano)', dosis: '25g post-entrenamiento', motivo: 'Ayuda a alcanzar tu objetivo diario de proteína' });
        supps.push({ nombre: 'Creatina monohidrato', dosis: '3-5g al día', motivo: 'Mejora la fuerza y la recuperación muscular' });
    }

    if (goal === 'perder_peso' || goal === 'mejorar_salud') {
        supps.push({ nombre: 'Omega-3 (EPA + DHA)', dosis: '1-2g al día con la comida', motivo: 'Beneficioso para la salud cardiovascular' });
    }

    if (dietary_preference === 'vegano' || dietary_preference === 'vegetariano') {
        supps.push({ nombre: 'Vitamina B12', dosis: 'Según indicación', motivo: 'Esencial en dietas plant-based' });
        supps.push({ nombre: 'Vitamina D3 + K2', dosis: 'Según indicación', motivo: 'Frecuentemente deficiente en dietas plant-based' });
    }

    // Avisos para condiciones de salud: se aconseja consultar, no se prescribe
    if (conditions.includes('diabetes')) {
        notas.push('Si tienes diabetes, consulta con tu médico antes de tomar cualquier suplemento, especialmente los que afectan a la glucemia.');
    }
    if (conditions.includes('hipertension')) {
        notas.push('Con hipertensión, evita los suplementos estimulantes (cafeína, yohimbina, etc.) sin supervisión médica.');
    }
    if (conditions.includes('colesterol')) {
        notas.push('Para el colesterol, habla con tu médico antes de usar suplementos (omega-3 en dosis altas, fitosteroles, levadura roja de arroz).');
    }
    if (conditions.includes('hipotiroidismo')) {
        notas.push('Con hipotiroidismo, el calcio y el hierro interfieren con la levotiroxina: sepáralos de la medicación y consulta a tu médico.');
    }
    if (conditions.includes('celiaquia')) {
        notas.push('En la celiaquía, verifica que cualquier suplemento esté certificado sin gluten.');
    }

    notas.push('Los suplementos son orientativos y no sustituyen una dieta equilibrada ni el consejo de un profesional de la salud.');

    return { supplements: supps, notas };
}

/**
 * Función principal: genera el plan completo del usuario.
 */
function generatePersonalizedPlan(answers) {
    const macros = calculateNutrition(answers);
    const { menu, notas_dieta } = generateWeeklyMenu(answers, macros);
    const trainingPlan = generateTrainingPlan(answers);
    const { supplements, notas: suplementosNotas } = generateSupplements(answers);

    // Calcular IMC
    const heightM = answers.height_cm / 100;
    const bmi = (answers.weight_kg / (heightM * heightM)).toFixed(1);
    const bmiCategory =
        bmi < 18.5 ? 'Peso insuficiente' :
            bmi < 25 ? 'Peso normal' :
                bmi < 30 ? 'Sobrepeso' : 'Obesidad';

    return {
        resumen: {
            imc: parseFloat(bmi),
            categoria_imc: bmiCategory,
            objetivo: answers.goal,
            nivel_actividad: answers.activity_level,
        },
        ...macros,
        weekly_menu: menu,
        notas_dieta,
        training_plan: trainingPlan,
        supplements,
        consejos_generales: [
            'Mantén horarios de comidas regulares para optimizar tu metabolismo.',
            'Duerme entre 7-9 horas para maximizar la recuperación y resultados.',
            'Lleva un registro de tus progresos semanalmente.',
            'La consistencia es más importante que la perfección.',
            ...suplementosNotas,
        ],
    };
}

module.exports = { generatePersonalizedPlan };
