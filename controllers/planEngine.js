/**
 * NutroVia — Motor de Planes Personalizados
 * Calcula el plan de nutrición y entrenamiento basado en el cuestionario.
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

// ─── Ajuste calórico por objetivo ───────────────────────────
const CALORIE_ADJUSTMENTS = {
    perder_peso: -500,
    ganar_masa: +400,
    mantener: 0,
    mejorar_salud: -200,
};

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
 * Calcula las calorías diarias y distribución de macros
 */
function calculateNutrition(answers) {
    const { sex, weight_kg, height_cm, age, goal, activity_level } = answers;
    const bmr = calculateBMR(sex, weight_kg, height_cm, age);
    const tdee = bmr * ACTIVITY_MULTIPLIERS[activity_level];
    const dailyCalories = Math.round(tdee + CALORIE_ADJUSTMENTS[goal]);

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

// Días de la semana
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Genera un menú semanal personalizado
 */
function generateWeeklyMenu(answers, macros) {
    const diet = answers.dietary_preference in FOOD_BASES
        ? answers.dietary_preference : 'omnivoro';
    const foods = FOOD_BASES[diet];
    const cals = macros.daily_calories;

    // Distribución de calorías por comida
    const dist = { desayuno: 0.25, almuerzo: 0.10, comida: 0.35, merienda: 0.10, cena: 0.20 };

    const menu = {};
    DAYS.forEach(day => {
        menu[day] = {
            desayuno: {
                nombre: `Avena con ${pick(foods.fats)} y fruta`,
                calorias: Math.round(cals * dist.desayuno),
                ingredientes: ['Avena (70g)', `${pick(foods.fats)}`, 'Plátano o frutos rojos', 'Leche vegetal o agua'],
            },
            almuerzo: {
                nombre: `Snack de ${pick(foods.proteins)}`,
                calorias: Math.round(cals * dist.almuerzo),
                ingredientes: [`${pick(foods.proteins)} (30g)`, 'Fruta de temporada'],
            },
            comida: {
                nombre: `${pick(foods.proteins)} con ${pick(foods.carbs)} y ${pick(foods.vegs)}`,
                calorias: Math.round(cals * dist.comida),
                ingredientes: [
                    `${pick(foods.proteins)} (150g)`,
                    `${pick(foods.carbs)} (100g en crudo)`,
                    `${pick(foods.vegs)} (200g)`,
                    'Aceite de oliva (1 cucharada)',
                ],
            },
            merienda: {
                nombre: `${pick(foods.fats)} con fruta`,
                calorias: Math.round(cals * dist.merienda),
                ingredientes: [`${pick(foods.fats)} (25g)`, 'Manzana o pera'],
            },
            cena: {
                nombre: `${pick(foods.proteins)} con ${pick(foods.vegs)} al horno`,
                calorias: Math.round(cals * dist.cena),
                ingredientes: [
                    `${pick(foods.proteins)} (130g)`,
                    `${pick(foods.vegs)} (250g)`,
                    'Aceite de oliva virgen (1 cucharada)',
                    'Especias al gusto',
                ],
            },
        };
    });
    return menu;
}

// ─── Planes de entrenamiento ─────────────────────────────────
const TRAINING_PLANS = {
    perder_peso: {
        principiante: [
            { dia: 'Lunes', tipo: 'Cardio moderado', ejercicios: ['Caminata rápida 30 min', 'Sentadillas 3x12', 'Fondos 3x8', 'Plancha 3x30s'] },
            { dia: 'Miércoles', tipo: 'Full Body', ejercicios: ['Burpees 3x10', 'Zancadas 3x12', 'Remo con goma 3x12', 'Abdominales 3x15'] },
            { dia: 'Viernes', tipo: 'HIIT ligero', ejercicios: ['Jumping jacks 4x30s', 'Mountain climbers 4x30s', 'Sentadillas sumo 3x15', 'Puente glúteo 3x15'] },
        ],
        intermedio: [
            { dia: 'Lunes', tipo: 'Tren inferior + cardio', ejercicios: ['Sentadillas 4x15', 'Peso muerto rumano 4x12', 'Prensa 3x15', 'HIIT 15 min'] },
            { dia: 'Martes', tipo: 'Tren superior', ejercicios: ['Press banca 4x12', 'Remo barra 4x12', 'Press militar 3x10', 'Curl biceps 3x12'] },
            { dia: 'Jueves', tipo: 'HIIT + core', ejercicios: ['HIIT 20 min', 'Plancha lateral 3x45s', 'Rueda abdominal 3x8', 'Hipopresivos 3x1min'] },
            { dia: 'Sábado', tipo: 'Full Body', ejercicios: ['Sentadilla búlgara 4x10', 'Dominadas 3x8', 'Fondos 3x10', 'Cardio 20 min'] },
        ],
        avanzado: [
            { dia: 'Lunes', tipo: 'Piernas', ejercicios: ['Sentadilla con barra 5x8', 'Peso muerto 4x6', 'Hack squat 4x12', 'Extensión isquio 4x12', 'Gemelos 4x15'] },
            { dia: 'Martes', tipo: 'Pecho + Tríceps', ejercicios: ['Press banca 5x6', 'Press inclinado 4x10', 'Aperturas 3x12', 'Fondos 4x10', 'Cuerda tríceps 4x12'] },
            { dia: 'Miércoles', tipo: 'HIIT + cardio', ejercicios: ['HIIT sprint 25 min', 'Core intensivo 15 min'] },
            { dia: 'Jueves', tipo: 'Espalda + Bíceps', ejercicios: ['Dominadas 5x6', 'Remo barra 4x8', 'Jalón 4x10', 'Curl martillo 4x12'] },
            { dia: 'Viernes', tipo: 'Hombros + Core', ejercicios: ['Press militar 4x8', 'Elevaciones laterales 4x12', 'Pájaro 4x12', 'Plancha 4x1min', 'Rueda abdominal 4x10'] },
        ],
    },

    ganar_masa: {
        principiante: [
            { dia: 'Lunes', tipo: 'Tren superior A', ejercicios: ['Press banca 3x8', 'Remo con mancuerna 3x10', 'Curl biceps 3x10', 'Press francés 3x10'] },
            { dia: 'Miércoles', tipo: 'Tren inferior', ejercicios: ['Sentadillas 3x8', 'Peso muerto 3x6', 'Zancadas 3x10', 'Extensiones cuádriceps 3x12'] },
            { dia: 'Viernes', tipo: 'Tren superior B', ejercicios: ['Press inclinado 3x8', 'Jalón polea 3x10', 'Press militar 3x8', 'Fondos 3x8'] },
        ],
        intermedio: [
            { dia: 'Lunes', tipo: 'Pecho + Bíceps', ejercicios: ['Press banca 4x8', 'Aperturas 3x12', 'Press inclinado 4x10', 'Curl barra 4x10', 'Curl martillo 3x12'] },
            { dia: 'Martes', tipo: 'Espalda + Tríceps', ejercicios: ['Dominadas 4x6', 'Remo barra 4x8', 'Jalón 3x12', 'Cuerda tríceps 4x12', 'Fondos 3x10'] },
            { dia: 'Jueves', tipo: 'Piernas', ejercicios: ['Sentadilla 4x8', 'Peso muerto rumano 4x10', 'Prensa 4x12', 'Curl isquio 4x12', 'Gemelos 4x15'] },
            { dia: 'Viernes', tipo: 'Hombros + Trapecios', ejercicios: ['Press militar 4x8', 'Elevaciones 4x12', 'Pájaro 4x12', 'Encogimientos 4x12'] },
        ],
        avanzado: [
            { dia: 'Lunes', tipo: 'Pecho', ejercicios: ['Press banca 5x5', 'Press inclinado 4x8', 'Aperturas 4x12', 'Pullover 3x12', 'Dips lastrados 4x8'] },
            { dia: 'Martes', tipo: 'Espalda', ejercicios: ['Peso muerto 5x4', 'Dominadas lastradas 4x6', 'Remo cable 4x10', 'Jalón trasnuca 3x10', 'Pull-over 3x12'] },
            { dia: 'Miércoles', tipo: 'Hombros', ejercicios: ['Press militar 5x6', 'Elevaciones laterales 5x12', 'Pájaro 4x12', 'Face pull 4x15', 'Encogimientos 4x12'] },
            { dia: 'Jueves', tipo: 'Piernas', ejercicios: ['Sentadilla 5x5', 'Hack squat 4x10', 'Prensa 4x12', 'Curl isquio 4x12', 'Extensión cuádriceps 4x12', 'Gemelos 5x15'] },
            { dia: 'Viernes', tipo: 'Brazos', ejercicios: ['Curl barra Z 5x10', 'Curl martillo 4x12', 'Cuerda tríceps 5x12', 'Fondos 4x10', 'Extensión sobre cabeza 4x12'] },
        ],
    },

    mantener: {
        principiante: [
            { dia: 'Lunes', tipo: 'Full Body', ejercicios: ['Sentadillas 3x12', 'Fondos 3x10', 'Remo 3x12', 'Plancha 3x30s', 'Caminata 20 min'] },
            { dia: 'Miércoles', tipo: 'Cardio + flexibilidad', ejercicios: ['Bici o elíptica 30 min', 'Yoga o estiramientos 20 min'] },
            { dia: 'Viernes', tipo: 'Full Body', ejercicios: ['Peso muerto 3x10', 'Press militar 3x10', 'Zancadas 3x12', 'Plancha lateral 3x30s'] },
        ],
        intermedio: [
            { dia: 'Lunes', tipo: 'Tren superior', ejercicios: ['Press banca 4x10', 'Remo 4x10', 'Press militar 3x10', 'Curl/Tríceps 3x12'] },
            { dia: 'Miércoles', tipo: 'Tren inferior', ejercicios: ['Sentadilla 4x10', 'Peso muerto 3x8', 'Zancadas 3x12', 'Puente glúteo 3x15'] },
            { dia: 'Viernes', tipo: 'Cardio + core', ejercicios: ['Cardio 30 min', 'Plancha 3x1min', 'Abdominales 3x20', 'Hipopresivos 3x1min'] },
        ],
        avanzado: [
            { dia: 'Lunes', tipo: 'Empuje', ejercicios: ['Press banca 4x8', 'Press inclinado 4x10', 'Press militar 4x8', 'Tríceps 4x12'] },
            { dia: 'Martes', tipo: 'Tirón', ejercicios: ['Dominadas 4x8', 'Remo 4x8', 'Jalón 4x10', 'Bíceps 4x12'] },
            { dia: 'Jueves', tipo: 'Piernas', ejercicios: ['Sentadilla 4x8', 'Peso muerto 4x6', 'Prensa 4x12', 'Gemelos 4x15'] },
            { dia: 'Sábado', tipo: 'Cardio + movilidad', ejercicios: ['Cardio 40 min', 'Movilidad articular 20 min'] },
        ],
    },

    mejorar_salud: {
        principiante: [
            { dia: 'Lunes', tipo: 'Cardio suave', ejercicios: ['Caminata 30 min', 'Estiramientos 15 min'] },
            { dia: 'Miércoles', tipo: 'Fuerza funcional', ejercicios: ['Sentadillas 3x10', 'Puente glúteo 3x12', 'Plancha 3x20s', 'Rotaciones 3x10'] },
            { dia: 'Viernes', tipo: 'Yoga o pilates', ejercicios: ['Sesión guiada 40 min'] },
        ],
        intermedio: [
            { dia: 'Lunes', tipo: 'Cardio moderado', ejercicios: ['Bici o correr 30 min', 'Estiramientos 10 min'] },
            { dia: 'Miércoles', tipo: 'Fuerza', ejercicios: ['Sentadillas 3x12', 'Fondos 3x10', 'Remo 3x12', 'Plancha 3x45s'] },
            { dia: 'Viernes', tipo: 'Pilates + movilidad', ejercicios: ['Pilates 30 min', 'Foam roller 15 min'] },
        ],
        avanzado: [
            { dia: 'Lunes', tipo: 'Cardio + fuerza', ejercicios: ['Carrera 5km', 'Circuito fuerza 3 rondas'] },
            { dia: 'Miércoles', tipo: 'Funcional', ejercicios: ['Kettlebell 30 min', 'TRX 20 min', 'Core 15 min'] },
            { dia: 'Viernes', tipo: 'Recuperación activa', ejercicios: ['Yoga 45 min', 'Estiramientos profundos 15 min'] },
        ],
    },
};

/**
 * Selecciona el plan de entrenamiento adecuado
 */
function generateTrainingPlan(answers) {
    const { goal, training_experience, training_days_per_week } = answers;
    const goalKey = goal in TRAINING_PLANS ? goal : 'mantener';
    const level = training_experience in TRAINING_PLANS[goalKey] ? training_experience : 'principiante';

    const allDays = TRAINING_PLANS[goalKey][level];
    // Ajustar al número de días preferido
    const days = Math.min(training_days_per_week || 3, allDays.length);
    const selectedDays = allDays.slice(0, days);

    return {
        nivel: level,
        objetivo: goalKey,
        dias_semana: days,
        sesiones: selectedDays,
        notas: [
            'Calienta siempre 5-10 minutos antes de cada sesión.',
            'Descansa 60-90 segundos entre series.',
            'Hidratación: mínimo 2 litros de agua al día.',
            'Si sientes dolor agudo, para el ejercicio inmediatamente.',
        ],
    };
}

/**
 * Genera recomendaciones de suplementación personalizadas
 */
function generateSupplements(answers) {
    const { goal, dietary_preference, health_conditions } = answers;
    const supps = [];

    // Base siempre recomendada
    supps.push({ nombre: 'Multivitamínico completo', dosis: '1 cápsula al día con el desayuno', motivo: 'Cubre posibles déficits nutricionales' });

    if (goal === 'ganar_masa' || goal === 'mantener') {
        supps.push({ nombre: 'Proteína Whey (o vegana para veganos)', dosis: '25g post-entrenamiento', motivo: 'Optimiza la síntesis proteica muscular' });
        supps.push({ nombre: 'Creatina monohidrato', dosis: '5g/día con agua', motivo: 'Mejora la fuerza y recuperación muscular' });
    }

    if (goal === 'perder_peso' || goal === 'mejorar_salud') {
        supps.push({ nombre: 'Omega-3 (EPA + DHA)', dosis: '2g/día con la comida', motivo: 'Antiinflamatorio, mejora la salud cardiovascular' });
        supps.push({ nombre: 'L-Carnitina', dosis: '2g 30 min antes de entrenar', motivo: 'Ayuda en la utilización de grasas como energía' });
    }

    if (dietary_preference === 'vegano' || dietary_preference === 'vegetariano') {
        supps.push({ nombre: 'Vitamina B12', dosis: '1000 mcg/semana', motivo: 'Esencial en dietas plant-based' });
        supps.push({ nombre: 'Vitamina D3 + K2', dosis: '2000-4000 UI/día', motivo: 'Suele ser deficiente en veganos' });
        supps.push({ nombre: 'Hierro (consultar con médico)', dosis: 'Según analítica', motivo: 'Mayor riesgo de déficit en plant-based' });
    }

    if (health_conditions && health_conditions.includes('diabetes')) {
        supps.push({ nombre: 'Berberina', dosis: '500mg 3x/día con comidas', motivo: 'Ayuda a regular la glucemia (consultar médico)' });
    }

    if (health_conditions && health_conditions.includes('hipertension')) {
        supps.push({ nombre: 'Magnesio glicinato', dosis: '200-400mg por la noche', motivo: 'Contribuye a reducir la presión arterial' });
    }

    return supps;
}

/**
 * Función principal: genera el plan completo del usuario
 */
function generatePersonalizedPlan(answers) {
    const macros = calculateNutrition(answers);
    const weeklyMenu = generateWeeklyMenu(answers, macros);
    const trainingPlan = generateTrainingPlan(answers);
    const supplements = generateSupplements(answers);

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
        weekly_menu: weeklyMenu,
        training_plan: trainingPlan,
        supplements,
        consejos_generales: [
            'Mantén horarios de comidas regulares para optimizar tu metabolismo.',
            'Duerme entre 7-9 horas para maximizar la recuperación y resultados.',
            'Lleva un registro de tus progresos semanalmente.',
            'La consistencia es más importante que la perfección.',
        ],
    };
}

module.exports = { generatePersonalizedPlan };
