import { describe, expect, it } from 'vitest';

import type { Identification } from '@/schemas/identification';
import type { MarketResearch } from '@/schemas/market';
import {
  CACHE_TTL_DAYS,
  ageInDays,
  cacheKey,
  decideCacheability,
  expiryFor,
  worthStoring,
} from './policy';

function identification(overrides: Partial<Identification> = {}): Identification {
  return {
    name: 'Macchina da scrivere Olivetti Valentine',
    category: 'design industriale',
    brand: 'Olivetti',
    model: 'Valentine',
    period: '1969',
    materials: [],
    characteristics: [],
    markings: [],
    condition: 'good',
    conditionNotes: [],
    history: '',
    confidence: 0.96,
    confidenceReasons: [],
    imageQuality: 'good',
    marketPace: 'slow',
    missingShots: [],
    searchQueries: [],
    ...overrides,
  };
}

const research = (comparables: number): MarketResearch => ({
  comparables: Array.from({ length: comparables }, (_, index) => ({
    title: `Annuncio ${index}`,
    source: 'eBay',
    url: `https://ebay.it/itm/${index}`,
    price: 400,
    currency: 'EUR' as const,
    kind: 'sold' as const,
    soldAt: null,
    condition: 'good' as const,
    matchLevel: 'exact_model' as const,
    notes: '',
  })),
  demand: 'medium',
  liquidity: 'average',
  notes: [],
});

describe('chiave della cache', () => {
  it('normalizza maiuscole, accenti e punteggiatura', () => {
    expect(cacheKey(identification({ brand: '  OLIVETTI ', model: 'Valentine!' }))).toBe(
      cacheKey(identification({ brand: 'olivetti', model: 'valentine' })),
    );
  });

  it('non confonde due modelli della stessa marca', () => {
    expect(cacheKey(identification({ model: 'Valentine' }))).not.toBe(
      cacheKey(identification({ model: 'Lettera 32' })),
    );
  });

  it('collide quando il modello e’ scritto con o senza accessori', () => {
    // Il caso vero: la stessa Canon e' uscita una volta come "AE-1" e una come
    // "AE-1 con FD 50mm f/1.8". Due chiavi diverse = ricerca ripagata.
    const corto = cacheKey(identification({ brand: 'Canon', model: 'AE-1' }));
    expect(cacheKey(identification({ brand: 'Canon', model: 'AE-1 con FD 50mm f/1.8' }))).toBe(corto);
    expect(cacheKey(identification({ brand: 'Canon', model: 'AE-1 with 50mm lens' }))).toBe(corto);
    expect(cacheKey(identification({ brand: 'Canon', model: 'AE-1, nera' }))).toBe(corto);
    expect(cacheKey(identification({ brand: 'Canon', model: 'AE-1 (Program)' }))).toBe(corto);
  });

  it('non esiste senza marca o senza modello', () => {
    expect(cacheKey(identification({ brand: null }))).toBeNull();
    expect(cacheKey(identification({ model: null }))).toBeNull();
    expect(cacheKey(identification({ model: '   ' }))).toBeNull();
  });
});

describe('quando si puo’ usare la cache', () => {
  it('sì per un oggetto riconosciuto con sicurezza', () => {
    expect(decideCacheability(identification())).toEqual({
      cacheable: true,
      key: 'olivetti|valentine',
    });
  });

  it('no se marca o modello mancano: la chiave servirebbe i dati di un altro oggetto', () => {
    const decision = decideCacheability(identification({ model: null }));
    expect(decision).toMatchObject({ cacheable: false });
  });

  it('no se l’identificazione e’ incerta', () => {
    const decision = decideCacheability(identification({ confidence: 0.6 }));
    expect(decision).toMatchObject({ cacheable: false, reason: 'identificazione troppo incerta' });
  });
});

describe('cosa vale la pena archiviare', () => {
  it('una ricerca con comparabili', () => {
    expect(worthStoring(research(3))).toBe(true);
  });

  it('non una ricerca vuota: quasi sempre e’ una ricerca andata male', () => {
    expect(worthStoring(research(0))).toBe(false);
  });
});

describe('scadenze', () => {
  it('il modernariato vive un mese, l’elettronica una settimana', () => {
    expect(CACHE_TTL_DAYS.slow).toBe(30);
    expect(CACHE_TTL_DAYS.medium).toBe(14);
    expect(CACHE_TTL_DAYS.fast).toBe(7);
  });

  it('l’elettronica scade sempre prima del modernariato', () => {
    expect(CACHE_TTL_DAYS.fast).toBeLessThan(CACHE_TTL_DAYS.medium);
    expect(CACHE_TTL_DAYS.medium).toBeLessThan(CACHE_TTL_DAYS.slow);
  });

  it('calcola la scadenza dal momento della ricerca', () => {
    const from = new Date('2026-08-23T10:00:00Z');
    expect(expiryFor('fast', from).toISOString()).toBe('2026-08-30T10:00:00.000Z');
    expect(expiryFor('slow', from).toISOString()).toBe('2026-09-22T10:00:00.000Z');
  });
});

describe('eta’ di una ricerca', () => {
  it('conta i giorni interi trascorsi', () => {
    const researched = new Date('2026-08-01T10:00:00Z');
    expect(ageInDays(researched, new Date('2026-08-01T23:00:00Z'))).toBe(0);
    expect(ageInDays(researched, new Date('2026-08-02T10:00:00Z'))).toBe(1);
    expect(ageInDays(researched, new Date('2026-08-14T09:00:00Z'))).toBe(12);
  });
});
