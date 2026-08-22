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

export const IMAGE_BUCKET = 'item-images';
