/**
 * NutroVia — Tests del servicio de acceso (tier free/pro)
 * Verifica la derivación del nivel a partir del estado de la suscripción
 * y el contador de regeneraciones, y los flags de funcionalidades.
 * Se mockea el módulo db para no depender de una base de datos real.
 */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Fake de db.query: devuelve filas según la query
function makeDb(rowsByKind) {
  return {
    async query(sql, params) {
      // rowsByKind: { subscriptions: rows, users: rows }
      if (/FROM subscriptions/i.test(sql)) {
        return { rows: rowsByKind.subscriptions || [] };
      }
      if (/FROM users/i.test(sql)) {
        return { rows: rowsByKind.users || [] };
      }
      return { rows: [] };
    },
  };
}

// Carga accessService apuntando al db fake
function loadAccess(dbMock) {
  require.cache[require.resolve('../db/db')] = {
    id: require.resolve('../db/db'),
    filename: require.resolve('../db/db'),
    loaded: true,
    exports: dbMock,
  };
  delete require.cache[require.resolve('../services/accessService')];
  return require('../services/accessService');
}

describe('accessService', () => {
  describe('getUserAccess', () => {
    test('sin suscripción → tier free con funciones restringidas', async () => {
      const db = makeDb({ subscriptions: [], users: [{ plan_regeneration_count: 0 }] });
      const access = await loadAccess(db).getUserAccess('u1');

      assert.strictEqual(access.tier, 'free');
      assert.strictEqual(access.isPro, false);
      assert.strictEqual(access.hasIA, false);
      assert.strictEqual(access.hasSupplements, false);
      assert.strictEqual(access.hasCheckins, false);
      assert.strictEqual(access.hasMealDetail, false);
      assert.strictEqual(access.maxRegenerations, 5);
    });

    test('suscripción active → tier pro con todo desbloqueado', async () => {
      const db = makeDb({ subscriptions: [{ status: 'active' }], users: [{ plan_regeneration_count: 5 }] });
      const access = await loadAccess(db).getUserAccess('u1');

      assert.strictEqual(access.tier, 'pro');
      assert.strictEqual(access.isPro, true);
      assert.strictEqual(access.hasIA, true);
      assert.strictEqual(access.hasSupplements, true);
      assert.strictEqual(access.hasCheckins, true);
      assert.strictEqual(access.hasMealDetail, true);
      assert.strictEqual(access.maxRegenerations, null, 'pro ilimitado');
    });

    test('trial cuenta como pro mientras dure la prueba', async () => {
      const db = makeDb({ subscriptions: [{ status: 'trial' }], users: [{ plan_regeneration_count: 0 }] });
      const access = await loadAccess(db).getUserAccess('u1');
      assert.strictEqual(access.tier, 'pro');
    });

    test('suscripción cancelada → vuelve a free', async () => {
      const db = makeDb({ subscriptions: [{ status: 'cancelled' }], users: [{ plan_regeneration_count: 1 }] });
      const access = await loadAccess(db).getUserAccess('u1');
      assert.strictEqual(access.tier, 'free');
      assert.strictEqual(access.isPro, false);
    });

    test('free por debajo del límite → puede regenerar', async () => {
      const db = makeDb({ subscriptions: [], users: [{ plan_regeneration_count: 0 }] });
      const access = await loadAccess(db).getUserAccess('u1');
      assert.strictEqual(access.canRegenerate, true);
    });

    test('free ha agotado el límite → no puede regenerar', async () => {
      const db = makeDb({ subscriptions: [], users: [{ plan_regeneration_count: 5 }] });
      const access = await loadAccess(db).getUserAccess('u1');
      assert.strictEqual(access.canRegenerate, false);
    });

    test('pro siempre puede regenerar aunque tenga muchas regeneraciones', async () => {
      const db = makeDb({ subscriptions: [{ status: 'active' }], users: [{ plan_regeneration_count: 42 }] });
      const access = await loadAccess(db).getUserAccess('u1');
      assert.strictEqual(access.canRegenerate, true);
    });
  });

  describe('incrementRegeneration', () => {
    test('incrementa el contador vía SQL', async (t) => {
      const db = makeDb({ subscriptions: [], users: [{ plan_regeneration_count: 0 }] });
      let sql = '';
      db.query = async (q) => {
        if (/plan_regeneration_count = plan_regeneration_count\+ 1|plan_regeneration_count = plan_regeneration_count \+ 1/i.test(q)) {
          sql = q;
        }
        return { rows: [] };
      };
      const svc = loadAccess(db);
      await svc.incrementRegeneration('u1');
      assert.ok(sql.includes('plan_regeneration_count'), 'debería emitir UPDATE del contador');
    });
  });
});