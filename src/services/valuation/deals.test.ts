import { describe, expect, it } from 'vitest';

import type { Comparable } from '@/schemas/market';
import type { PriceThresholds, Valuation, WeightedComparable } from '@/schemas/analysis';
import { findDeals } from './deals';

function comparable(overrides: Partial<Comparable> = {}): Comparable {
  return {
    title: 'Artemide Tolomeo',
    source: 'eBay',
    url: 'https://example.test/1',
    price: 100,
    currency: 'EUR',
    kind: 'asking',
    soldAt: null,
    condition: 'good',
    matchLevel: 'exact_model',
    notes: '',
    ...overrides,
  };
}

function weighted(priceEur: number, overrides: Partial<Comparable> = {}): WeightedComparable {
  return {
    comparable: comparable({ price: priceEur, url: `https://example.test/${priceEur}`, ...overrides }),
    priceEur,
    weight: 1,
    weightBreakdown: { match: 1, condition: 1 },
  };
}

function valuation(used: WeightedComparable[]): Valuation {
  return {
    available: true,
    currency: 'EUR',
    low: 80,
    likely: 120,
    high: 160,
    confidence: 'high',
    confidenceScore: 0.8,
    used,
    discarded: [],
    strongCount: used.length,
    identicalCount: used.length,
    comparableTier: 'identical',
    dispersion: 0.2,
    reasons: [],
  };
}

const soglie: PriceThresholds = {
  buyUpTo: 50,
  maybeUpTo: 75,
  breakdown: {
    expectedSalePrice: 120,
    fees: 15.6,
    riskBuffer: 12,
    targetProfit: 25,
  },
};

describe('findDeals', () => {
  it('segnala solo cio’ che sta sotto il prezzo massimo', () => {
    const deals = findDeals(valuation([weighted(30), weighted(45), weighted(60)]), soglie);
    expect(deals.map((deal) => deal.priceEur)).toEqual([30, 45]);
  });

  it('mette per primo il piu’ conveniente', () => {
    const deals = findDeals(valuation([weighted(45), weighted(20), weighted(35)]), soglie);
    expect(deals.map((deal) => deal.priceEur)).toEqual([20, 35, 45]);
  });

  it('somma la spedizione quando la conosce, e sul totale fa il confronto', () => {
    // 45 € sarebbe un affare; con 12 € di spedizione verso l'Italia non lo e'
    // piu', e la soglia va applicata al totale che pagheresti davvero.
    const deals = findDeals(valuation([weighted(45, { shippingToItalyEur: 12 })]), soglie);
    expect(deals).toHaveLength(0);
  });

  it('porta il totale sbarcato quando la spedizione e’ nota', () => {
    const deals = findDeals(valuation([weighted(30, { shippingToItalyEur: 8 })]), soglie);
    expect(deals[0]?.landedEur).toBe(38);
    expect(deals[0]?.comparedEur).toBe(38);
    expect(deals[0]?.underByEur).toBe(12);
  });

  it('confronta sul prezzo nudo quando la spedizione non e’ nota', () => {
    const deals = findDeals(valuation([weighted(45)]), soglie);
    expect(deals[0]?.landedEur).toBeNull();
    expect(deals[0]?.comparedEur).toBe(45);
  });

  it('non suggerisce un oggetto diverso, per quanto costi poco', () => {
    const deals = findDeals(
      valuation([weighted(10, { matchLevel: 'same_brand' }), weighted(12, { matchLevel: 'same_family' })]),
      soglie,
    );
    expect(deals).toHaveLength(0);
  });

  it('non suggerisce un’asta aperta: quel prezzo non e’ comprabile', () => {
    const deals = findDeals(valuation([weighted(20, { kind: 'bid' })]), soglie);
    expect(deals).toHaveLength(0);
  });

  it('tace quando non esiste un prezzo massimo', () => {
    const deals = findDeals(valuation([weighted(10)]), { ...soglie, buyUpTo: null });
    expect(deals).toHaveLength(0);
  });

  it('tace quando non c’e’ una stima', () => {
    const deals = findDeals(
      { available: false, reason: 'Niente comparabili', discarded: [], observed: null },
      soglie,
    );
    expect(deals).toHaveLength(0);
  });

  it('non ne mostra piu’ di tre: un catalogo non e’ una segnalazione', () => {
    const deals = findDeals(
      valuation([weighted(10), weighted(15), weighted(20), weighted(25), weighted(30)]),
      soglie,
    );
    expect(deals).toHaveLength(3);
    expect(deals.map((deal) => deal.priceEur)).toEqual([10, 15, 20]);
  });
});
