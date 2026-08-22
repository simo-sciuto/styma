import { describe, expect, it } from 'vitest';

import type { Identification } from '@/schemas/identification';
import type { Comparable, MarketResearch } from '@/schemas/market';
import { valuate } from './valuate';
import { assessFlip } from './flip-score';

const identification: Identification = {
  name: 'Lampada da tavolo',
  category: 'illuminazione',
  brand: 'Artemide',
  model: 'Tolomeo',
  period: 'anni 90',
  materials: ['alluminio'],
  characteristics: ['braccio articolato'],
  markings: ['Artemide Made in Italy'],
  condition: 'good',
  conditionNotes: [],
  history: 'Classico del design italiano.',
  confidence: 0.9,
  confidenceReasons: ['marchio leggibile'],
  imageQuality: 'good',
  missingShots: [],
  searchQueries: ['artemide tolomeo usata'],
};

function comparable(overrides: Partial<Comparable>): Comparable {
  return {
    title: 'Artemide Tolomeo',
    source: 'eBay',
    url: 'https://example.test/1',
    price: 100,
    currency: 'EUR',
    kind: 'sold',
    soldAt: new Date().toISOString().slice(0, 10),
    condition: 'good',
    matchLevel: 'exact_model',
    notes: '',
    ...overrides,
  };
}

function research(comparables: Comparable[]): MarketResearch {
  return { comparables, demand: 'medium', liquidity: 'average', notes: [] };
}

describe('valuate', () => {
  it('non produce una stima quando non ci sono comparabili', () => {
    const valuation = valuate(identification, research([]));
    expect(valuation.available).toBe(false);
  });

  it('scarta i comparabili troppo deboli invece di diluirli nella forbice', () => {
    const valuation = valuate(
      identification,
      research([
        comparable({ url: 'https://example.test/a', price: 100 }),
        comparable({ url: 'https://example.test/b', price: 110 }),
        comparable({
          url: 'https://example.test/c',
          price: 9000,
          matchLevel: 'similar_category',
          kind: 'asking',
          soldAt: null,
          condition: 'poor',
        }),
      ]),
    );

    expect(valuation.available).toBe(true);
    if (!valuation.available) return;
    expect(valuation.used).toHaveLength(2);
    expect(valuation.discarded).toHaveLength(1);
    expect(valuation.high).toBeLessThan(1000);
  });

  it('rifiuta di stimare con un solo comparabile utilizzabile', () => {
    const valuation = valuate(identification, research([comparable({ price: 115 })]));

    expect(valuation.available).toBe(false);
    if (valuation.available) return;
    expect(valuation.reason).toMatch(/troppo poco/i);
  });

  it('non spaccia per certezza la sicurezza del modello su pochi dati', () => {
    const valuation = valuate(
      identification,
      research([
        comparable({ url: 'https://example.test/a', price: 115 }),
        comparable({ url: 'https://example.test/b', price: 115 }),
      ]),
    );

    expect(valuation.available).toBe(true);
    if (!valuation.available) return;
    // identification.confidence e' 0.96 e i due prezzi coincidono:
    // senza il tetto sul campione uscirebbe "confidenza alta".
    expect(valuation.confidence).not.toBe('high');
    // e la forbice non puo' collassare su un punto solo.
    expect(valuation.high).toBeGreaterThan(valuation.low);

    const weak = valuate(
      identification,
      research(
        [110, 115, 120].map((price, index) =>
          comparable({ url: `https://example.test/w${index}`, price, kind: 'asking', soldAt: null }),
        ),
      ),
    );
    expect(weak.available).toBe(true);
    if (!weak.available) return;
    expect(weak.confidence).toBe('low');
  });

  it('restringe la forbice quando i comparabili sono molti', () => {
    const few = valuate(
      identification,
      research(
        [100, 100].map((price, index) => comparable({ price, url: `https://example.test/f${index}` })),
      ),
    );
    const many = valuate(
      identification,
      research(
        Array.from({ length: 10 }, (_, index) =>
          comparable({ price: 100, url: `https://example.test/m${index}` }),
        ),
      ),
    );

    expect(few.available && many.available).toBe(true);
    if (!few.available || !many.available) return;
    expect(many.high - many.low).toBeLessThan(few.high - few.low);
    expect(many.confidenceScore).toBeGreaterThan(few.confidenceScore);
  });

  it('colloca la forbice attorno ai comparabili e resta ordinata', () => {
    const prices = [80, 90, 100, 110, 120];
    const valuation = valuate(
      identification,
      research(prices.map((price, index) => comparable({ price, url: `https://example.test/${index}` }))),
    );

    expect(valuation.available).toBe(true);
    if (!valuation.available) return;
    expect(valuation.low).toBeLessThanOrEqual(valuation.likely);
    expect(valuation.likely).toBeLessThanOrEqual(valuation.high);
    expect(valuation.likely).toBeGreaterThanOrEqual(80);
    expect(valuation.likely).toBeLessThanOrEqual(120);
    expect(valuation.soldCount).toBe(5);
  });

  it('tiene il valore probabile dentro la forbice, non sul bordo', () => {
    // Distribuzione reale osservata in campo: tre vendite molto distanti fra loro.
    const valuation = valuate(
      identification,
      research([
        comparable({ url: 'https://example.test/a', price: 190, source: 'Catawiki' }),
        comparable({ url: 'https://example.test/b', price: 546, condition: 'excellent' }),
        comparable({ url: 'https://example.test/c', price: 690, kind: 'asking', soldAt: null }),
      ]),
    );

    expect(valuation.available).toBe(true);
    if (!valuation.available) return;
    expect(valuation.likely).toBeGreaterThan(valuation.low);
    expect(valuation.likely).toBeLessThan(valuation.high);
  });

  it('abbassa la confidenza quando ci sono solo prezzi richiesti', () => {
    const asking = valuate(
      identification,
      research(
        [80, 100, 120].map((price, index) =>
          comparable({ price, kind: 'asking', soldAt: null, url: `https://example.test/${index}` }),
        ),
      ),
    );
    const sold = valuate(
      identification,
      research(
        [80, 100, 120].map((price, index) => comparable({ price, url: `https://example.test/${index}` })),
      ),
    );

    expect(asking.available && sold.available).toBe(true);
    if (!asking.available || !sold.available) return;
    expect(asking.confidenceScore).toBeLessThan(sold.confidenceScore);
  });
});

describe('assessFlip', () => {
  const valuation = valuate(
    identification,
    research(
      [95, 100, 105, 110].map((price, index) =>
        comparable({ price, url: `https://example.test/${index}` }),
      ),
    ),
  );

  it('non produce raccomandazioni senza una valutazione', () => {
    const empty = valuate(identification, research([]));
    expect(assessFlip(identification, null, empty, 10)).toBeNull();
  });

  it('il punteggio scende al salire del prezzo di acquisto', () => {
    const cheap = assessFlip(identification, research([]), valuation, 10);
    const expensive = assessFlip(identification, research([]), valuation, 90);

    expect(cheap?.atPrice?.score ?? 0).toBeGreaterThan(expensive?.atPrice?.score ?? 0);
  });

  it('le soglie sono coerenti con le raccomandazioni che produce', () => {
    const assessment = assessFlip(identification, research([]), valuation, null);
    expect(assessment).not.toBeNull();
    if (!assessment) return;

    const { buyUpTo, maybeUpTo } = assessment.thresholds;
    expect(buyUpTo).not.toBeNull();
    expect(maybeUpTo).not.toBeNull();
    if (buyUpTo === null || maybeUpTo === null) return;

    expect(buyUpTo).toBeLessThanOrEqual(maybeUpTo);
    expect(assessFlip(identification, research([]), valuation, buyUpTo)?.atPrice?.recommendation).toBe(
      'BUY',
    );
    expect(
      assessFlip(identification, research([]), valuation, maybeUpTo + 5)?.atPrice?.recommendation,
    ).toBe('PASS');
  });
});
