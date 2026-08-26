/**
 * NutroVia — Servicio de generación de planes con IA
 *
 * Genera el contenido personalizado del plan (menú semanal, entrenamiento,
 * suplementos y consejos) con un LLM compatible con la API de OpenAI.
 *
 * Diseño:
 *  - Las CALORÍAS Y MACROS SIEMPRE los calcula el motor determinista
 *    (controllers/planEngine.js), que aplica suelos/topes de seguridad.
 *    La IA solo genera el CONTENIDO, nunca los números.
 *  - Si no hay API key configurada, la llamada falla o el JSON no valida,
 *    se devuelve null y el llamador usa el plan determinista (fallback).
 *  - La respuesta se valida contra el esquema del plan antes de usarla.
 *
 * Variables de entorno (todas opcionales):
 *  - OPENAI_API_KEY   (obligatoria para activar la IA; con Groq por defecto, esta
 *                      variable debe contener la clave de Groq "gsk_...")
 *  - AI_PLAN_MODEL    (por defecto "openai/gpt-oss-20b" de Groq — 1000 tok/s,
 *                      suficiente para generar el plan completo dentro del
 *                      límite de 10s de Vercel Hobby; "openai/gpt-oss-120b"
 *                      produce mejor texto pero tarda el doble)
 *  - AI_PLAN_API_URL  (por defecto la de Groq; permite usar OpenAI, DeepInfra,
 *                      Fireworks u otros endpoints compatibles con OpenAI)
 *  - AI_PLAN_TIMEOUT_MS (por defecto 8000 — seguro dentro del límite de 10s de
 *                      Vercel Hobby. Para dar más tiempo a la IA: sube el límite
 *                      en Vercel → Settings → Functions → Default Max Duration,
 *                      y define aquí p.ej. AI_PLAN_TIMEOUT_MS=45000)
 */

// Por defecto se usa Groq (muy rápido, cabe en el límite de 10s de Vercel
// Hobby; GPT-OSS 20B cuesta ~0,04 céntimos por plan generado). OpenAI y otros
// proveedores compatibles se eligen definiendo AI_PLAN_API_URL y AI_PLAN_MODEL.
const AI_PLAN_MODEL = process.env.AI_PLAN_MODEL || 'openai/gpt-oss-20b';
const AI_PLAN_API_URL = process.env.AI_PLAN_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const AI_PLAN_TIMEOUT_MS = parseInt(process.env.AI_PLAN_TIMEOUT_MS || '8000', 10);

function isConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

// ─── Prompt del sistema: reglas de seguridad innegociables ──
const SYSTEM_PROMPT = `Eres el nutricionista y entrenador personal de NutroVia, una app española de nutrición y entrenamiento. Generas un plan personalizado en español para un usuario concreto.

REGLAS OBLIGATORIAS:
1. Responde SIEMPRE en español.
2. Usa EXACTAMENTE las calorías y macros diarios que se te dan (daily_calories, protein_g, carbs_g, fat_g). NUNCA los modifiques ni inventes otros. Las comidas deben sumar aproximadamente esas calorías.
3. No diagnostiques ni trates enfermedades. Ante condiciones de salud, adapta la dieta y el entrenamiento con sentido común (diabetes: hidratos de bajo índice glucémico, control de raciones; hipertensión: poco sodio, sin sal añadida; colesterol: limita carnes rojas y grasas saturadas; hipotiroidismo: aporte de yodo/selenio; celiaquía: 100% sin gluten) e incluye una nota de "consulta con tu médico o profesional de la salud" cuando proceda.
4. NO prescribas suplementos ni dosis para condiciones médicas. Los suplementos deben ser generales y prudentes (multivitamínico, omega-3, proteína, creatina, B12 para veganos...), con dosis orientativas y la advertencia de consultar a un profesional de la salud.
5. Respeta estrictamente la preferencia dietética: vegano = cero productos animales (ni miel, ni lácteos, ni huevos); vegetariano = sin carne ni pescado; sin gluten = cero trigo/cebada/centeno (avena solo si es certificada sin gluten); sin lactosa = cero lácteos.
6. Respeta el equipamiento de entrenamiento: "casa" = solo peso corporal, gomas elásticas o mancuernas; "gimnasio" = máquinas y barras; "mixto" = ambos.
7. Genera exactamente tantas sesiones de entrenamiento como "training_days_per_week" indique el perfil (entre 1 y 6), repartidas por la semana.
8. Comidas y ejercicios reales, concretos y ejecutables. Nada genérico ni inventado. Ingredientes: entre 3 y 5 por comida, con cantidades aproximadas en gramos coherentes con las calorías de esa comida.
9. Devuelve ÚNICAMENTE un objeto JSON válido. Sin markdown, sin comentarios, sin texto fuera del JSON.
10. Sé específico y variado: usa nombres descriptivos (nada genérico como "Ensalada mixta"), no repitas el mismo plato dos días seguidos, y da cantidades en gramos coherentes con las calorías de cada comida.
11. No añadas campos, texto ni explicaciones fuera de la estructura JSON del ejemplo: solo weekly_menu, training_plan, supplements, notas_dieta y consejos_generales.`;

/**
 * Normaliza el plan devuelto por la IA antes de validarlo:
 *  - claves de comida en minúsculas ("Desayuno" → "desayuno")
 *  - calorias numéricas aunque vengan como "450 kcal" o "450"
 */
function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') return plan;
  if (plan.weekly_menu && typeof plan.weekly_menu === 'object') {
    for (const day of Object.values(plan.weekly_menu)) {
      if (!day || typeof day !== 'object') continue;
      for (const key of Object.keys(day)) {
        const lower = key.toLowerCase();
        if (lower !== key && ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena'].includes(lower)) {
          day[lower] = day[key];
          delete day[key];
        }
      }
      for (const meal of ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena']) {
        const m = day[meal];
        if (!m || typeof m !== 'object') continue;
        if (typeof m.calorias === 'string') {
          const n = parseInt(m.calorias.replace(/[^\d]/g, ''), 10);
          if (!isNaN(n)) m.calorias = n;
        }
      }
    }
  }
  return plan;
}

/**
 * Valida la estructura del plan generado por la IA.
 * Devuelve true si el shape es usable (con tolerancias razonables).
 * Registra el motivo exacto del fallo para poder diagnosticar.
 */
function validatePlanShape(plan) {
  if (!plan || typeof plan !== 'object') {
    console.error('IA: shape — el plan no es un objeto');
    return false;
  }

  if (!plan.weekly_menu || typeof plan.weekly_menu !== 'object') {
    console.error('IA: shape — falta weekly_menu');
    return false;
  }
  const days = Object.values(plan.weekly_menu).filter(d => d && typeof d === 'object');
  if (days.length < 5) {
    console.error(`IA: shape — solo ${days.length} días válidos (se esperan >= 5)`);
    return false;
  }
  for (const d of days) {
    for (const k of ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena']) {
      const meal = d[k];
      if (!meal || typeof meal.nombre !== 'string' || !meal.nombre.length) {
        console.error(`IA: shape — falta nombre en comida "${k}"`);
        return false;
      }
      if (typeof meal.calorias !== 'number') {
        console.error(`IA: shape — calorias no numérico en "${k}": ${JSON.stringify(meal.calorias)}`);
        return false;
      }
      if (!Array.isArray(meal.ingredientes)) {
        console.error(`IA: shape — ingredientes no es array en "${k}"`);
        return false;
      }
    }
  }

  if (plan.training_plan && typeof plan.training_plan === 'object') {
    const sessions = plan.training_plan.sesiones;
    if (!Array.isArray(sessions) || sessions.length === 0) {
      console.error('IA: shape — training_plan sin sesiones');
      return false;
    }
    if (!sessions.every(s =>
      s && typeof s.dia === 'string' && typeof s.tipo === 'string' && Array.isArray(s.ejercicios) && s.ejercicios.length > 0
    )) {
      console.error('IA: shape — sesión de entrenamiento incompleta');
      return false;
    }
  }

  if (plan.supplements !== undefined && !Array.isArray(plan.supplements)) {
    console.error('IA: shape — supplements no es array');
    return false;
  }

  return true;
}

// ─── Palabras prohibidas por preferencia/condición (red de seguridad) ──
// Si la IA incluye alguna en el menú, se descarta su menú y se usa el del motor.
const FORBIDDEN_WORDS = {
  vegano: ['pollo', 'salmón', 'atun', 'atún', 'huevo', 'ternera', 'pavo', 'gambas', 'queso', 'yogur', 'leche', 'mantequilla', 'miel', 'sardinas', 'pechuga', 'cerdo', 'jamón', 'jamon'],
  vegetariano: ['pollo', 'salmón', 'atun', 'atún', 'ternera', 'pavo', 'gambas', 'sardinas', 'pechuga', 'cerdo', 'jamón', 'jamon'],
  sin_gluten: ['pan de trigo', 'pasta de trigo', 'harina de trigo', 'trigo', 'cebada', 'centeno'],
};

function menuContainsForbidden(weeklyMenu, forbidden) {
  if (!weeklyMenu || !forbidden || forbidden.length === 0) return false;
  const text = JSON.stringify(weeklyMenu).toLowerCase();
  return forbidden.some(w => text.includes(w));
}

/**
 * Genera el plan con IA.
 * @param {object} answers  Respuestas del cuestionario
 * @param {object} macros   { daily_calories, protein_g, carbs_g, fat_g } del motor
 * @returns {Promise<object|null>} plan parcial o null (fallback al motor)
 */
async function generatePersonalizedPlanWithAI(answers, macros) {
  if (!isConfigured()) return null;

  const conditions = (answers.health_conditions || []).filter(c => c !== 'ninguna');
  const userProfile = {
    edad: answers.age,
    sexo: answers.sex,
    peso_kg: answers.weight_kg,
    altura_cm: answers.height_cm,
    peso_objetivo_kg: answers.target_weight_kg || null,
    objetivo: answers.goal,
    nivel_actividad: answers.activity_level,
    preferencia_dietetica: answers.dietary_preference,
    condiciones_salud: conditions,
    experiencia_entrenamiento: answers.training_experience,
    dias_entrenamiento_semana: answers.training_days_per_week || 3,
    equipamiento: answers.training_equipment || 'mixto',
  };

  const userPrompt = `Genera el plan personalizado con EXACTAMENTE esta estructura JSON (traduce los nombres de los campos tal cual):

{
  "weekly_menu": {
    "Lunes": {
      "desayuno": { "nombre": "Nombre corto", "calorias": 400, "ingredientes": ["Avena (70g)", "Frutos rojos", "Canela"] },
      "almuerzo": { "nombre": "...", "calorias": 200, "ingredientes": ["..."] },
      "comida": { "nombre": "...", "calorias": 550, "ingredientes": ["..."] },
      "merienda": { "nombre": "...", "calorias": 150, "ingredientes": ["..."] },
      "cena": { "nombre": "...", "calorias": 400, "ingredientes": ["..."] }
    },
    "Martes": { ... }, "Miércoles": { ... }, "Jueves": { ... }, "Viernes": { ... }, "Sábado": { ... }, "Domingo": { ... }
  },
  "training_plan": {
    "nivel": "principiante|intermedio|avanzado",
    "objetivo": "perder_peso|ganar_masa|mantener|mejorar_salud",
    "dias_semana": 3,
    "equipamiento": "casa|gimnasio|mixto",
    "sesiones": [ { "dia": "Lunes", "tipo": "Tren superior", "ejercicios": ["Press banca 4x10", "Remo 4x10"] } ],
    "progresion": ["Nota de progresión semana a semana"],
    "notas": ["Notas de seguridad e hidratación"]
  },
  "supplements": [ { "nombre": "...", "dosis": "...", "motivo": "..." } ],
  "notas_dieta": ["Notas específicas de tu dieta o condiciones de salud"],
  "consejos_generales": ["Consejos prácticos"]
}

La suma de las calorías de las 5 comidas de cada día debe ser aproximadamente igual a daily_calories.

PERFIL DEL USUARIO:
${JSON.stringify(userProfile, null, 2)}

MACROS DIARIOS (úsalos tal cual):
${JSON.stringify(macros, null, 2)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_PLAN_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(AI_PLAN_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_PLAN_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          // Sin response_format json_object: el modo JSON de Groq (y otros
          // proveedores) rechaza con 400 "Failed to validate JSON" prompts
          // anidados como este. El prompt exige JSON estricto y abajo se
          // valida + fallback al motor si algo no cuadra.
          // max_tokens 4000: el plan completo supera los 2000 tokens y se
          // truncaba ("Unterminated string"). GPT-OSS a 500 tok/s genera
          // 4000 tokens en ~8s, dentro del timeout.
          temperature: 0.8,
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      // Intentar leer el detalle del error (tipo: insufficient_quota, rate_limit_exceeded...)
      let detail = '';
      try {
        const errBody = await res.json();
        detail = errBody?.error?.message || errBody?.error?.type || '';
      } catch (_) { /* cuerpo no legible */ }
      console.error(`IA: error HTTP ${res.status} generando plan (${res.statusText})${detail ? ' — ' + detail : ''}`);
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    // Quitar posibles cercos markdown ```json ... ```
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let plan;
    try {
      plan = JSON.parse(cleaned);
    } catch (err) {
      console.error(`IA: JSON no parseable (${err.message}) — inicio de la respuesta: ${content.slice(0, 300).replace(/\n/g, ' ')}`);
      return null;
    }

    plan = normalizePlan(plan);

    if (!validatePlanShape(plan)) {
      return null;
    }

    // Red de seguridad: si el menú incluye alimentos prohibidos para la
    // preferencia/condición del usuario, descartamos el menú de la IA.
    const forbidden = FORBIDDEN_WORDS[answers.dietary_preference];
    if (menuContainsForbidden(plan.weekly_menu, forbidden)) {
      console.error('IA: menú con alimentos prohibidos para la dieta del usuario — se usa el del motor');
      plan.weekly_menu = null;
    }
    if (conditions.includes('celiaquia') && menuContainsForbidden(plan.weekly_menu, FORBIDDEN_WORDS.sin_gluten)) {
      console.error('IA: menú con gluten para usuario celíaco — se usa el del motor');
      plan.weekly_menu = null;
    }

    return plan;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('IA: timeout generando plan — fallback al motor');
    } else {
      console.error('IA: error generando plan:', err.message);
    }
    return null;
  }
}

module.exports = { generatePersonalizedPlanWithAI, isConfigured };
