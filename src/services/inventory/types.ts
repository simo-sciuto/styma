import type { Recommendation } from '@/schemas/analysis';
import type { Authenticity } from '@/schemas/identification';
import type { AnalysisSnapshot } from '@/schemas/snapshot';

export type ItemStatus = 'found' | 'passed' | 'bought' | 'listed' | 'sold';

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  found: 'Da decidere',
  passed: 'Lasciato perdere',
  bought: 'Comprato',
  listed: 'In vendita',
  sold: 'Venduto',
};

/** L'ordine in cui un oggetto attraversa il magazzino, per le liste. */
export const ITEM_STATUS_ORDER: ItemStatus[] = ['found', 'passed', 'bought', 'listed', 'sold'];

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
  materials: string[];
  characteristics: string[];
  condition_notes: string[];
  markings: string[];
  /** Fuori dalla lista, dentro i dati. Null = visibile. */
  archived_at: string | null;
  /**
   * Cosa reggeva l'attribuzione al momento dell'analisi. Mai un verdetto di
   * autenticita': vedi `AuthenticitySchema`.
   */
  authenticity: Authenticity | null;
  /** Quanto chiedeva chi vendeva. Non e' quanto hai pagato: vedi `purchase_price`. */
  asking_price: number | null;
  purchase_price: number | null;
  /**
   * Quello che l'oggetto ti e' costato oltre il prezzo di acquisto: pulizia,
   * ricambi, trasporto, ingresso al mercato. Senza, il margine del magazzino
   * e' sempre piu' alto di quello vero, ed e' l'unica voce di costo che chi
   * rivende paga di tasca sua a ogni oggetto.
   */
  extra_costs: number | null;
  /** In che cosa, scritto da chi vende. Non e' un elenco strutturato apposta. */
  extra_costs_note: string | null;
  purchase_currency: string;
  purchase_date: string | null;
  purchase_location: string | null;
  listed_at: string | null;
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
  /** Quando e' stata fatta la ricerca su cui poggia la fascia. Null se non c'e' stata. */
  market_researched_at: string | null;
  market_research_cached: boolean | null;
  /** Su cosa poggiava la fascia: solo stesso modello, anche simili, o solo debole evidenza. */
  comparable_tier: 'identical' | 'similar' | 'weak' | null;
  /**
   * L'analisi come e' stata mostrata, per rimostrarla identica. Null sugli
   * oggetti salvati prima che esistesse, e su quelli il cui JSON non supera
   * piu' lo schema: in entrambi i casi resta la scheda ridotta.
   */
  snapshot: unknown;
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
  kind: 'sold' | 'asking' | 'bid';
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
  snapshot: AnalysisSnapshot | null;
  comparables: ComparableRow[];
  imageUrls: string[];
};

export const IMAGE_BUCKET = 'item-photos';

/**
 * Su cosa poggiava davvero una valutazione salvata. Riaprire un oggetto fra
 * un mese e leggere la stessa fascia senza sapere se la ricerca era fresca
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

/**
 * Se la fascia salvata poggiava sullo stesso identico modello o su oggetti
 * solo simili. Il caso "identical" e' quello normale e non si segnala: si
 * dice solo quando la fascia e' uscita da un ripiego.
 */
export function describeSavedComparableTier(tier: ValuationRow['comparable_tier']): string | null {
  if (tier === 'similar') {
    return 'Nessun annuncio dello stesso identico modello: la fascia include anche oggetti simili.';
  }
  if (tier === 'weak') {
    return 'Nessun comparabile davvero vicino: la fascia esce da annunci della stessa categoria.';
  }
  return null;
}
