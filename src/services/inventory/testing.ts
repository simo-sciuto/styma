import type { ItemRow, ValuationRow } from './types';

/**
 * Costruttori per i test dell'inventario.
 *
 * Stanno in un file solo perche' un campo nuovo su `items` ha gia' rotto
 * cinque costruttori copiati: con uno solo, aggiungere una colonna e' una
 * riga in un posto invece di una caccia. Nessun codice dell'applicazione
 * importa questo file.
 */

export function item(overrides: Partial<ItemRow> = {}): ItemRow {
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
    authenticity: null,
    archived_at: null,
    asking_price: null,
    listing_url: null,
    listing_source: null,
    purchase_price: null,
    extra_costs: null,
    extra_costs_note: null,
    purchase_currency: 'EUR',
    purchase_date: null,
    purchase_location: null,
    listed_at: null,
    sale_price: null,
    sale_date: null,
    marketplace: null,
    status: 'found',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function valuation(overrides: Partial<ValuationRow> = {}): ValuationRow {
  return {
    id: 'v1',
    item_id: 'i1',
    currency: 'EUR',
    low_value: null,
    high_value: null,
    likely_value: null,
    confidence: 'medium',
    confidence_score: 0.5,
    flip_score: null,
    recommendation: null,
    assessed_at_price: null,
    market_researched_at: null,
    market_research_cached: null,
    comparable_tier: 'identical',
    snapshot: null,
    reasoning: {},
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Una fascia stretta attorno a un valore, quando serve solo "una stima c'e'". */
export function valuedAt(likely: number | null): ValuationRow {
  return valuation({ low_value: likely, high_value: likely, likely_value: likely });
}
