import { describe, expect, it } from 'vitest';

import { valuation } from '@/services/inventory/testing';
import { suggestPrice } from './price';

/** Una valutazione che ha prodotto una fascia: il caso normale, qui. */
const conFascia = (overrides = {}) =>
  valuation({ low_value: 100, high_value: 200, likely_value: 150, ...overrides });

describe('prezzo suggerito per un annuncio', () => {
  it('usa il valore probabile della valutazione, arrotondato', () => {
    const price = suggestPrice(conFascia({ likely_value: 149.6 }));
    expect(price).toEqual({ amount: 150, low: 100, high: 200, confidence: 'medium' });
  });

  it('non suggerisce nulla senza una valutazione', () => {
    expect(suggestPrice(null)).toBeNull();
  });

  it('non suggerisce nulla se la valutazione non aveva prodotto una fascia', () => {
    // Il caso "non lo so": low/high/likely/confidence sono tutti null.
    const price = suggestPrice(
      conFascia({ low_value: null, high_value: null, likely_value: null, confidence: null }),
    );
    expect(price).toBeNull();
  });

  it('non inventa un prezzo a meta’: se manca un solo campo, niente prezzo', () => {
    expect(suggestPrice(conFascia({ confidence: null }))).toBeNull();
  });
});
