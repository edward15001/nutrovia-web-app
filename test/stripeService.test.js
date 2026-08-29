const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const stripeModulePath = require.resolve('stripe');
const servicePath = require.resolve('../services/stripeService');

function loadService({ stripeKey = 'sk_test_key', stripeClient } = {}) {
  process.env.STRIPE_SECRET_KEY = stripeKey;
  process.env.PLAN_PRICE_EUR = '14';

  require.cache[stripeModulePath] = {
    id: stripeModulePath,
    filename: stripeModulePath,
    loaded: true,
    exports: () => stripeClient,
  };
  delete require.cache[servicePath];
  return require('../services/stripeService');
}

describe('stripeService', () => {
  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.PLAN_PRICE_EUR = '14';
  });

  afterEach(() => {
    delete require.cache[servicePath];
    delete require.cache[stripeModulePath];
    delete process.env.STRIPE_SECRET_KEY;
  });

  test('crea SetupIntent para guardar tarjeta sin cobro', async () => {
    const calls = [];
    const service = loadService({
      stripeClient: {
        setupIntents: {
          create: async options => {
            calls.push(options);
            return { id: 'seti_123', client_secret: 'seti_secret' };
          },
        },
      },
    });

    const intent = await service.createSetupIntent('cus_123');

    assert.strictEqual(intent.id, 'seti_123');
    assert.deepStrictEqual(calls[0], {
      customer: 'cus_123',
      payment_method_types: ['card'],
      usage: 'off_session',
    });
  });

  test('crea un Price mensual de 14 € y una suscripción con cobro inmediato (sin trial)', async () => {
    const calls = { pricesList: [], pricesCreate: [], subscriptions: [] };
    const service = loadService({
      stripeClient: {
        prices: {
          list: async options => {
            calls.pricesList.push(options);
            return { data: [] };
          },
          create: async options => {
            calls.pricesCreate.push(options);
            return { id: 'price_14_eur' };
          },
        },
        subscriptions: {
          create: async options => {
            calls.subscriptions.push(options);
            return { id: 'sub_123', status: 'active' };
          },
        },
      },
    });

    const subscription = await service.createSubscription('cus_123');

    assert.strictEqual(subscription.id, 'sub_123');
    assert.strictEqual(calls.pricesCreate[0].currency, 'eur');
    assert.strictEqual(calls.pricesCreate[0].unit_amount, 1400);
    assert.deepStrictEqual(calls.pricesCreate[0].recurring, { interval: 'month' });
    // Sin trial_end: la primera factura se cobra al momento
    assert.deepStrictEqual(calls.subscriptions[0], {
      customer: 'cus_123',
      items: [{ price: 'price_14_eur' }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
  });

  test('reutiliza un Price existente de 14 €', async () => {
    const calls = { createPrice: 0, createSubscription: 0 };
    const service = loadService({
      stripeClient: {
        prices: {
          list: async () => ({ data: [{ id: 'price_existing', unit_amount: 1400 }] }),
          create: async () => { calls.createPrice += 1; return { id: 'unexpected' }; },
        },
        subscriptions: {
          create: async options => {
            calls.createSubscription += 1;
            assert.deepStrictEqual(options.items, [{ price: 'price_existing' }]);
            return { id: 'sub_existing_price' };
          },
        },
      },
    });

    await service.createSubscription('cus_123');

    assert.strictEqual(calls.createPrice, 0);
    assert.strictEqual(calls.createSubscription, 1);
  });

  test('recupera el método de pago de un SetupIntent móvil', async () => {
    const service = loadService({
      stripeClient: {
        setupIntents: {
          retrieve: async id => ({ id, payment_method: 'pm_123' }),
        },
      },
    });

    const intent = await service.retrieveSetupIntent('seti_123');
    assert.strictEqual(intent.payment_method, 'pm_123');
  });

  test('cancelación de suscripción es idempotente si Stripe ya no la encuentra', async () => {
    const service = loadService({
      stripeClient: {
        subscriptions: {
          cancel: async () => {
            const error = new Error('No such subscription: sub_old');
            error.type = 'StripeInvalidRequestError';
            throw error;
          },
        },
      },
    });

    const result = await service.cancelSubscription('sub_old');
    assert.strictEqual(result.status, 'already_canceled');
  });

  test('sin clave usa mocks locales para no bloquear el desarrollo', async () => {
    const service = loadService({ stripeKey: undefined, stripeClient: null });
    delete process.env.STRIPE_SECRET_KEY;

    const customerId = await service.createCustomer('test@example.com', 'Test');
    const intent = await service.createSetupIntent(customerId);
    const subscription = await service.createSubscription(customerId);

    assert.match(customerId, /^cus_mock_/);
    assert.strictEqual(intent.id, 'seti_mock_123');
    assert.match(subscription.id, /^sub_mock_/);
  });
});
