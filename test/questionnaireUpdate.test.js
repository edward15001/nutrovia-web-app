/**
 * Vytal — Tests del flujo de actualización del cuestionario.
 * Prueba el límite de regeneraciones sin depender de PostgreSQL ni servicios externos.
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

const dbPath = require.resolve('../db/db');
const accessPath = require.resolve('../services/accessService');
const generationPath = require.resolve('../services/planGenerationService');
const emailPath = require.resolve('../services/emailService');
const routePath = require.resolve('../routes/questionnaire');
const authPath = require.resolve('../middleware/auth');

const payload = {
  age: 30,
  sex: 'hombre',
  weight_kg: 80,
  height_cm: 180,
  target_weight_kg: 75,
  goal: 'perder_peso',
  activity_level: 'moderado',
  dietary_preference: 'omnivoro',
  health_conditions: [],
  training_experience: 'intermedio',
  training_days_per_week: 3,
  training_equipment: 'gimnasio',
};

function loadRouter({ firstTime, canRegenerate, isPro = false }) {
  const calls = { generation: 0, increment: 0 };

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      async query(sql) {
        if (/SELECT id FROM questionnaire_answers/i.test(sql)) {
          return { rows: firstTime ? [] : [{ id: 'answer-1' }] };
        }
        return { rows: [] };
      },
    },
  };

  require.cache[accessPath] = {
    id: accessPath,
    filename: accessPath,
    loaded: true,
    exports: {
      async getUserAccess() {
        return { isPro, canRegenerate };
      },
      async incrementRegeneration() {
        calls.increment += 1;
      },
    },
  };

  require.cache[generationPath] = {
    id: generationPath,
    filename: generationPath,
    loaded: true,
    exports: {
      async generateAndSavePlan() {
        calls.generation += 1;
        return {
          resumen: 'Plan actualizado',
          daily_calories: 2200,
          protein_g: 160,
          carbs_g: 220,
          fat_g: 70,
          supplements: [],
          notas_dieta: [],
          consejos_generales: [],
        };
      },
    },
  };

  require.cache[emailPath] = {
    id: emailPath,
    filename: emailPath,
    loaded: true,
    exports: { sendNutritionPlanEmail: async () => {} },
  };

  delete require.cache[routePath];
  delete require.cache[authPath];
  const router = require('../routes/questionnaire');
  return { router, calls };
}

function request(router, token, body) {
  return new Promise((resolve, reject) => {
    const app = express();
    app.use(express.json());
    app.use('/', router);
    const server = http.createServer(app);

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        method: 'POST',
        path: '/',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }, response => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          server.close(() => {
            resolve({ status: response.statusCode, body: JSON.parse(data) });
          });
        });
      });
      req.on('error', reject);
      req.end(JSON.stringify(body));
    });
  });
}

function tokenFor(userId = 'user-1') {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign({ id: userId, name: 'Test', email: 'test@example.com' }, process.env.JWT_SECRET);
}

describe('POST /api/questionnaire — actualización', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    [dbPath, accessPath, generationPath, emailPath, routePath, authPath]
      .forEach(path => delete require.cache[path]);
  });

  test('actualiza un plan existente cuando el free aún puede regenerar', async () => {
    const { router, calls } = loadRouter({ firstTime: false, canRegenerate: true });
    const response = await request(router, tokenFor(), payload);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.message, 'Plan actualizado correctamente');
    assert.strictEqual(calls.generation, 1);
    assert.strictEqual(calls.increment, 1);
  });

  test('bloquea la actualización free al alcanzar el límite', async () => {
    const { router, calls } = loadRouter({ firstTime: false, canRegenerate: false });
    const response = await request(router, tokenFor(), payload);

    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.body.code, 'REGENERATION_LIMIT');
    assert.match(response.body.error, /límite de planes gratuitos/i);
    assert.strictEqual(calls.generation, 0);
    assert.strictEqual(calls.increment, 0);
  });

  test('permite actualizar a Pro aunque tenga agotado el límite free', async () => {
    const { router, calls } = loadRouter({ firstTime: false, canRegenerate: true, isPro: true });
    const response = await request(router, tokenFor(), payload);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.message, 'Plan actualizado correctamente');
    assert.strictEqual(response.body.access.isPro, true);
    assert.strictEqual(calls.generation, 1);
    assert.strictEqual(calls.increment, 1);
  });
});
