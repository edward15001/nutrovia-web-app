// ─── NutroVia — services/aiVisionService.js ──────────────────
// Analiza una foto de comida con un modelo de visión (Groq) y extrae lo que
// hay en el plato: alimentos, kcal y macros aproximados. Devuelve un array
// JSON normalizado y validado. Si no hay key configurada, la llamada falla
// o el JSON no valida, se devuelve null (el llamador decide el fallback).
//
// Variables de entorno (todas opcionales):
//  - OPENAI_API_KEY       (clave de Groq "gsk_..." que activa la IA)
//  - AI_VISION_MODEL      (por defecto "qwen/qwen3.6-27b", modelo multimodal de Groq)
//  - AI_PLAN_API_URL      (por defecto la de Groq; permite otros endpoints OpenAI compatibles)
//  - AI_PLAN_TIMEOUT_MS   (por defecto 45000)
//  - AI_PLAN_MAX_RETRIES  (por defecto 2)

const AI_VISION_MODEL = process.env.AI_VISION_MODEL || 'qwen/qwen3.6-27b';
const AI_VISION_API_URL = process.env.AI_PLAN_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const AI_VISION_TIMEOUT_MS = parseInt(process.env.AI_PLAN_TIMEOUT_MS || '45000', 10);
const AI_VISION_MAX_RETRIES = parseInt(process.env.AI_PLAN_MAX_RETRIES || '2', 10);
const AI_VISION_RETRY_BASE_DELAY_MS = parseInt(process.env.AI_PLAN_RETRY_BASE_DELAY_MS || '2000', 10);
const AI_VISION_RETRY_MAX_DELAY_MS = parseInt(process.env.AI_PLAN_RETRY_MAX_DELAY_MS || '10000', 10);

function isConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

function computeRetryDelay(retryAfterSeconds, attempt) {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, AI_VISION_RETRY_MAX_DELAY_MS);
  }
  const exponential = AI_VISION_RETRY_BASE_DELAY_MS * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(exponential + jitter, AI_VISION_RETRY_MAX_DELAY_MS);
}

async function fetchWithRetry(url, options) {
  let attempt = 0;
  for (;;) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_VISION_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err.name === 'AbortError';
      if (attempt < AI_VISION_MAX_RETRIES && (isTimeout || err.cause || err.type === 'system')) {
        const delay = computeRetryDelay(null, attempt);
        attempt++;
        await sleep(delay);
        continue;
      }
      throw err;
    }
    clearTimeout(timeout);

    if (isRetryableStatus(res.status) && attempt < AI_VISION_MAX_RETRIES) {
      let retryAfter;
      try { retryAfter = parseInt(res.headers?.get?.('retry-after'), 10); } catch (_) {}
      const delay = computeRetryDelay(retryAfter, attempt);
      attempt++;
      await sleep(delay);
      continue;
    }

    return res;
  }
}

const SYSTEM_PROMPT = `Eres el nutricionista de NutroVia, una app española de nutrición. Analizas una foto de comida y extraes lo que hay en el plato.

REGLAS:
1. Responde SIEMPRE en español.
2. Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura (sin markdown, sin comentarios, sin texto fuera del JSON):
   {
     "items": [
       {
         "name": "Nombre corto del alimento o plato",
         "calories": 0,
         "protein_g": 0,
         "carbs_g": 0,
         "fat_g": 0
       }
     ],
     "total": { "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 },
     "overview": "Resumen breve en 1 frase de qué hay en el plato"
   }
3. Los valores de macros son ESTIMACIONES razonables para la ración visible en la foto (no por 100g necesariamente): qué cantidad hay en el plato.
4. Si hay varios alimentos/ingredientes distintivos, lista varios items (máximo 8).
5. Si percibes un riesgo (algo crudo, moho, sospechoso), añade un campo "safety_warning" con el texto.
6. Los números deben ser coherentes: protein*4 + carbs*4 + fat*9 ≈ calories.`;

/**
 * Analiza una foto de comida (imagen en base64) y devuelve los alimentos.
 * @param {string} dataUrl - Data URI de la imagen (data:image/jpeg;base64,...)
 * @returns {Promise<object|null>} { items, total, overview, safety_warning? } o null
 */
async function analyzeFoodImage(dataUrl) {
  if (!isConfigured()) return null;
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;

  try {
    const res = await fetchWithRetry(AI_VISION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_VISION_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analiza esta foto de comida y dime qué hay en el plato con sus estimaciones.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      console.error(`IA Visión: error HTTP ${res.status} analizando imagen`);
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    // Quitar cercos markdown
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error(`IA Visión: JSON no parseable (${err.message})`);
      return null;
    }

    if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      console.error('IA Visión: sin items válidos');
      return null;
    }

    // Normalizar items numéricos
    parsed.items = parsed.items
      .filter(i => i && typeof i === 'object' && i.name)
      .map(i => ({
        name: String(i.name).slice(0, 200),
        calories: Number(i.calories) || 0,
        protein_g: Number(i.protein_g) || 0,
        carbs_g: Number(i.carbs_g) || 0,
        fat_g: Number(i.fat_g) || 0,
      }));

    if (parsed.items.length === 0) return null;

    // Recomponer total a partir de items (fiabilidad sobre el total de la IA)
    const total = parsed.items.reduce(
      (acc, i) => ({
        calories: acc.calories + i.calories,
        protein_g: acc.protein_g + i.protein_g,
        carbs_g: acc.carbs_g + i.carbs_g,
        fat_g: acc.fat_g + i.fat_g,
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );

    return {
      items: parsed.items,
      total,
      overview: typeof parsed.overview === 'string' ? parsed.overview : '',
      safety_warning: typeof parsed.safety_warning === 'string' ? parsed.safety_warning : null,
    };
  } catch (err) {
    console.error('IA Visión: error analizando imagen:', err.message);
    return null;
  }
}

/**
 * Compara unas kcal/macros con el objetivo diario del plan y devuelve si cuadra
 * ("dentro"/"fuera") junto con un mensaje orientativo. Si no hay plan, no compara.
 */
function compareWithPlan(calories, plan) {
  if (!plan || !plan.daily_calories) {
    return { matches_plan: null, feedback: 'Registrado. Completa tu cuestionario para recibir tu plan y saber si cuadra.' };
  }

  // Cuánto porcentaje de las kcal diarias supone esta comida
  const pct = plan.daily_calories > 0 ? (calories / plan.daily_calories) * 100 : 0;
  // Una comida del plan suele rondar el 15-30% de las kcal diarias. Un aporte
  // trivial (<80 kcal) o dentro del margen razonable (<=35%) encaja bien.
  if (calories < 80 || pct <= 35) {
    return {
      matches_plan: 'dentro',
      feedback: `Este aporte ronda el ${Math.round(pct)}% de tus ${plan.daily_calories} kcal diarias. Encaja bien con tu plan.`,
    };
  }
  return {
    matches_plan: 'fuera',
    feedback: `Este plato son ${(calories / plan.daily_calories * 100).toFixed(0)}% de tus kcal diarias (${calories} kcal). Te recomiendo tenerlo en cuenta en el resto del día.`,
  };
}

module.exports = {
  analyzeFoodImage,
  compareWithPlan,
  VISION_MODEL: AI_VISION_MODEL,
  isConfigured,
};