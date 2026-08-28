const { test, describe } = require('node:test');
const assert = require('node:assert');

function makeFetchWithTimeout(fetchImpl, timeoutMs) {
  return async function fetchWithTimeout(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(path, { ...options, signal: controller.signal });
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error('La carga está tardando demasiado. Comprueba tu conexión e inténtalo de nuevo.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
}

describe('Peticiones del dashboard', () => {
  test('propaga la respuesta cuando llega a tiempo', async () => {
    const fetchDashboard = makeFetchWithTimeout(
      async (path, options) => ({ path, signalAborted: options.signal.aborted }),
      50
    );

    const response = await fetchDashboard('/api/plan');
    assert.deepStrictEqual(response, { path: '/api/plan', signalAborted: false });
  });

  test('convierte un timeout en un error visible para el usuario', async () => {
    const fetchDashboard = makeFetchWithTimeout(
      (_path, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
      5
    );

    await assert.rejects(
      fetchDashboard('/api/plan'),
      /La carga está tardando demasiado/
    );
  });

  test('propaga errores de red sin convertirlos en timeout', async () => {
    const fetchDashboard = makeFetchWithTimeout(
      async () => { throw new Error('Error de red'); },
      50
    );

    await assert.rejects(fetchDashboard('/api/plan'), /Error de red/);
  });
});
