import type { Recommendation } from '@/schemas/analysis';

export type ItemStatus = 'found' | 'bought' | 'listed' | 'sold';

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  found: 'Trovato',
  bought: 'Comprato',
  listed: 'In vendita',
  sold: 'Venduto',
};

export type ItemRow = {
  id: string;
  title: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  estimated_period: string | null;
  condition: string | null;
  identification_confidence: number | null;
  purchase_price: number | null;
  purchase_currency: string;
  purchase_date: string | null;
  purchase_location: string | null;
  sale_price: number | null;
  sale_date: string | null;
  marketplace: string | null;
  status: ItemStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ValuationRow = {
  id: string;
  item_id: string;
  currency: string;
  low_value: number | null;
  high_value: number | null;
  likely_value: number | null;
  confidence: 'high' | 'medium' | 'low' | null;
  confidence_score: number | null;
  flip_score: number | null;
  recommendation: Recommendation | null;
  assessed_at_price: number | null;
  /** Quando e' stata fatta la ricerca su cui poggia la forbice. Null se non c'e' stata. */
  market_researched_at: string | null;
  market_research_cached: boolean | null;
  reasoning: {
    factors?: { label: string; direction: 'positive' | 'negative' }[];
    reasons?: string[];
    warnings?: string[];
    demand?: string;
    liquidity?: string;
    unavailableReason?: string;
    thresholds?: { buyUpTo: number | null; maybeUpTo: number | null };
  };
  created_at: string;
};

export type ComparableRow = {
  id: string;
  title: string;
  source: string;
  url: string;
  price: number;
  currency: string;
  kind: 'sold' | 'asking';
  sold_at: string | null;
  condition: string | null;
  match_level: string | null;
  similarity_score: number | null;
  used: boolean;
  discard_reason: string | null;
  notes: string | null;
};

export type ItemImageRow = {
  id: string;
  storage_path: string;
  sort_order: number;
};

export type InventoryEntry = {
  item: ItemRow;
  valuation: ValuationRow | null;
  coverUrl: string | null;
};

export type ItemDetail = {
  item: ItemRow;
  valuation: ValuationRow | null;
  comparables: ComparableRow[];
  imageUrls: string[];
};

export const IMAGE_BUCKET = 'item-photos';

/**
 * Su cosa poggiava davvero una valutazione salvata. Riaprire un oggetto fra
 * un mese e leggere la stessa forbice senza sapere se la ricerca era fresca
 * la farebbe sembrare piu' solida di com'era.
 */
export function describeSavedMarketSource(valuation: {
  market_researched_at: string | null;
  market_research_cached: boolean | null;
  created_at: string;
}): string | null {
  if (!valuation.market_researched_at) return null;

  const researched = Date.parse(valuation.market_researched_at);
  const assessed = Date.parse(valuation.created_at);
  if (Number.isNaN(researched) || Number.isNaN(assessed)) return null;

  if (!valuation.market_research_cached) {
    return 'Comparabili cercati al momento dell’analisi.';
  }

  const days = Math.floor((assessed - researched) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Comparabili riusati da una ricerca dello stesso giorno.';
  if (days === 1) return 'Comparabili riusati da una ricerca del giorno prima.';
  return `Comparabili riusati da una ricerca di ${days} giorni prima dell’analisi.`;
}
