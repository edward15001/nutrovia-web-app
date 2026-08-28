const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');

const dbPath = require.resolve('../db/db');
const stripePath = require.resolve('../services/stripeService');
const emailPath = require.resolve('../services/emailService');
const routePath = require.resolve('../routes/webhook');

function loadWebhook({ event, constructError, dbRows = {} }) {
  const queries = [];
  const emails = [];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      async query(sql, params) {
        queries.push({ sql, params });
        if (/SELECT id, name, email FROM users/i.test(sql)) {
          return { rows: dbRows.user || [] };
        }
        if (/SELECT id FROM users/i.test(sql)) {
          return { rows: dbRows.userId || [] };
        }
        return { rows: [] };
      },
    },
  };

  require.cache[stripePath] = {
    id: stripePath,
    filename: stripePath,
    loaded: true,
    exports: {
      constructWebhookEvent() {
        if (constructError) throw constructError;
        return event;
      },
    },
  };

  require.cache[emailPath] = {
    id: emailPath,
    filename: emailPath,
    loaded: true,
    exports: {
      async sendPaymentConfirmedEmail(...args) {
        emails.push({ type: 'payment', args });
      },
      async sendTrialWillEndEmail(...args) {
        emails.push({ type: 'trial', args });
      },
    },
  };

  delete require.cache[routePath];
  const router = require('../routes/webhook');
  return { router, queries, emails };
}

function request(router, body, signature = 'valid-signature') {
  return new Promise((resolve, reject) => {
    const app = express();
    app.use('/api/webhook', router);
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        method: 'POST',
        path: '/api/webhook/stripe',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'stripe-signature': signature,
        },
      }, response => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          server.close(() => resolve({ status: response.statusCode, body: JSON.parse(data) }));
        });
      });
      req.on('error', reject);
      req.end(body);
    });
  });
}

describe('POST /api/webhook/stripe', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_key';
  });

  afterEach(() => {
    [dbPath, stripePath, emailPath, routePath].forEach(path => delete require.cache[path]);
    delete process.env.STRIPE_SECRET_KEY;
  });

  test('procesa un pago exitoso y activa la suscripción correspondiente', async () => {
    const event = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_123',
          customer: 'cus_123',
          subscription: 'sub_123',
          amount_paid: 1400,
          period_start: 1770000000,
          period_end: 1772592000,
        },
      },
    };
    const { router, queries, emails } = loadWebhook({
      event,
      dbRows: { user: [{ id: 'user-1', name: 'Test', email: 'test@example.com' }] },
    });

    const response = await request(router, JSON.stringify({ raw: true }));

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, { received: true });
    assert.ok(queries.some(q => /INSERT INTO payment_history/i.test(q.sql)));
    assert.ok(queries.some(q => /UPDATE subscriptions/i.test(q.sql) && q.params.includes('sub_123')));
    assert.strictEqual(emails.length, 1);
    assert.strictEqual(emails[0].type, 'payment');
    assert.strictEqual(emails[0].args[1], 14);
  });

  test('rechaza una firma inválida con 400', async () => {
    const { router } = loadWebhook({
      constructError: new Error('Firma inválida'),
    });

    const response = await request(router, JSON.stringify({ raw: true }));

    assert.strictEqual(response.status, 400);
    assert.match(response.body.error, /Webhook Error: Firma inválida/);
  });
});
