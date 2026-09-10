import { describe, expect, it } from 'vitest';

import { summarizeInventory } from './summary';
import { flipConfig } from '@/services/valuation/config';
import type { ItemRow, ItemStatus, ValuationRow } from './types';

function item(overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id: 'i1',
    title: 'Oggetto',
    category: null,
    brand: null,
    model: null,
    description: null,
    estimated_period: null,
    condition: null,
    identification_confidence: null,
    materials: [],
    characteristics: [],
    condition_notes: [],
    markings: [],
    purchase_price: null,
    purchase_currency: 'EUR',
    purchase_date: null,
    purchase_location: null,
    sale_price: null,
    sale_date: null,
    marketplace: null,
    status: 'found' as ItemStatus,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function valuation(likely: number | null): ValuationRow {
  return {
    id: 'v1',
    item_id: 'i1',
    currency: 'EUR',
    low_value: likely,
    high_value: likely,
    likely_value: likely,
    confidence: 'medium',
    confidence_score: 0.5,
    flip_score: null,
    recommendation: null,
    assessed_at_price: null,
    market_researched_at: null,
    market_research_cached: null,
    comparable_tier: 'identical',
    reasoning: {},
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('totali del magazzino', () => {
  it('un inventario vuoto non inventa zeri', () => {
    const summary = summarizeInventory([]);
    expect(summary.items).toBe(0);
    // Null, non 0: "hai speso 0 €" e "non hai registrato spese" non sono
    // la stessa cosa, e il secondo e' cio' che sappiamo davvero.
    expect(summary.spentEur).toBeNull();
    expect(summary.estimatedValueEur).toBeNull();
    expect(summary.potentialMarginEur).toBeNull();
  });

  it('somma solo gli oggetti che hanno il dato, e dichiara quanti sono', () => {
    const summary = summarizeInventory([
      { item: item({ purchase_price: 10 }), valuation: valuation(100) },
      { item: item({ purchase_price: null }), valuation: valuation(50) },
      { item: item({ purchase_price: 5 }), valuation: null },
    ]);

    expect(summary.items).toBe(3);
    expect(summary.valued).toBe(2);
    expect(summary.estimatedValueEur).toBe(150);
    expect(summary.bought).toBe(2);
    expect(summary.spentEur).toBe(15);
  });

  it('il margine esce solo dagli oggetti che hanno prezzo pagato e stima', () => {
    // Il secondo oggetto ha una stima ma non un prezzo pagato: sommarlo
    // gonfierebbe il margine con un ricavo senza il suo costo.
    const summary = summarizeInventory([
      { item: item({ purchase_price: 10 }), valuation: valuation(100) },
      { item: item({ purchase_price: null }), valuation: valuation(900) },
    ]);

    expect(summary.withBoth).toBe(1);

    const atteso = Math.round(
      100 - 10 - 100 * flipConfig.marketplaceFeeRate - flipConfig.defaultShippingCost,
    );
    expect(summary.potentialMarginEur).toBe(atteso);
  });

  it('un margine puo’ essere negativo, e resta negativo', () => {
    // Pagato piu' di quanto vale: nasconderlo o azzerarlo sarebbe la bugia
    // piu' comoda di un inventario.
    const summary = summarizeInventory([
      { item: item({ purchase_price: 200 }), valuation: valuation(50) },
    ]);
    expect(summary.potentialMarginEur).toBeLessThan(0);
  });

  it('conta gli oggetti per stato', () => {
    const summary = summarizeInventory([
      { item: item({ status: 'found' }), valuation: null },
      { item: item({ status: 'sold' }), valuation: null },
      { item: item({ status: 'sold' }), valuation: null },
    ]);
    expect(summary.byStatus).toEqual({ found: 1, bought: 0, listed: 0, sold: 2 });
  });
});
