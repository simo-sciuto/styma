import type { ValuationRow } from '@/services/inventory/types';

export type SuggestedPrice = {
  amount: number;
  low: number;
  high: number;
  confidence: 'high' | 'medium' | 'low';
};

/**
 * Il prezzo suggerito per un annuncio, dalla valutazione gia' salvata.
 *
 * Non e' il modello a deciderlo: e' `valuation.likely_value`, lo stesso
 * numero gia' calcolato e mostrato in `services/valuation`. Qui non si
 * inventa nulla — o la valutazione c'e', o non si suggerisce un prezzo.
 */
export function suggestPrice(valuation: ValuationRow | null): SuggestedPrice | null {
  if (!valuation) return null;
  const { likely_value, low_value, high_value, confidence } = valuation;
  if (likely_value === null || low_value === null || high_value === null || confidence === null) {
    return null;
  }

  return {
    amount: Math.round(likely_value),
    low: Math.round(low_value),
    high: Math.round(high_value),
    confidence,
  };
}
