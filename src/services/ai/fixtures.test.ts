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
