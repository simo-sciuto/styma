import { describe, expect, it } from 'vitest';

import type { ValuationRow } from '@/services/inventory/types';
import { suggestPrice } from './price';

function valuation(overrides: Partial<ValuationRow> = {}): ValuationRow {
  return {
    id: 'v1',
    item_id: 'i1',
    currency: 'EUR',
    low_value: 100,
    high_value: 200,
    likely_value: 150,
    confidence: 'medium',
    confidence_score: 0.6,
    flip_score: null,
    recommendation: null,
    assessed_at_price: null,
    market_researched_at: null,
    market_research_cached: null,
    comparable_tier: 'identical',
    reasoning: {},
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('prezzo suggerito per un annuncio', () => {
  it('usa il valore probabile della valutazione, arrotondato', () => {
    const price = suggestPrice(valuation({ likely_value: 149.6 }));
    expect(price).toEqual({ amount: 150, low: 100, high: 200, confidence: 'medium' });
  });

  it('non suggerisce nulla senza una valutazione', () => {
    expect(suggestPrice(null)).toBeNull();
  });

  it('non suggerisce nulla se la valutazione non aveva prodotto una fascia', () => {
    // Il caso "non lo so": low/high/likely/confidence sono tutti null.
    const price = suggestPrice(
      valuation({ low_value: null, high_value: null, likely_value: null, confidence: null }),
    );
    expect(price).toBeNull();
  });

  it('non inventa un prezzo a meta’: se manca un solo campo, niente prezzo', () => {
    expect(suggestPrice(valuation({ confidence: null }))).toBeNull();
  });
});
