import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** Importa il modulo da zero: `getProvider` memorizza la scelta al primo giro. */
async function freshGetProvider() {
  vi.resetModules();
  const fresh = await import('./index');
  return fresh.getProvider;
}

describe('scelta del provider', () => {
  it('rifiuta le registrazioni in produzione', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STYMA_AI_FIXTURES', '1');

    expect(await freshGetProvider()).toThrow(/produzione/);
  });

  it('rifiuta anche la registrazione in produzione', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STYMA_AI_RECORD', '1');

    expect(await freshGetProvider()).toThrow(/produzione/);
  });

  it('in sviluppo usa le registrazioni quando richiesto', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('STYMA_AI_FIXTURES', '1');
    const getProvider = await freshGetProvider();

    expect(getProvider().constructor.name).toBe('FixtureProvider');
  });

  it('senza variabili chiama il modello vero', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('STYMA_AI_FIXTURES', '');
    vi.stubEnv('STYMA_AI_RECORD', '');
    const getProvider = await freshGetProvider();

    expect(getProvider().constructor.name).toBe('AnthropicProvider');
  });
});

describe('quando manca la registrazione', () => {
  it('lo dice invece di far credere a un guasto del servizio', async () => {
    // "Il servizio di analisi non risponde" mandava a cercare un guasto che
    // non c'era: il servizio sta benissimo, manca la registrazione.
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('STYMA_AI_FIXTURES', '1');
    const getProvider = await freshGetProvider();

    const error = await getProvider()
      .identify([{ mediaType: 'image/jpeg', data: 'ZmludG8=' }])
      .then(() => null)
      .catch((caught: unknown) => caught);

    // Non `instanceof`: `resetModules` ricarica il grafo, quindi la classe
    // importata qui e quella lanciata la' sono due oggetti diversi.
    const thrown = error as { code?: string; message?: string };
    expect(thrown.code).toBe('fixture_missing');
    expect(thrown.message).toMatch(/STYMA_AI_FIXTURES/);
    expect(thrown.message).toMatch(/STYMA_AI_RECORD/);
  });
});
