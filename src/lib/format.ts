const eur = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const eurPrecise = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

export function formatEur(value: number, { precise = false } = {}) {
  return (precise ? eurPrecise : eur).format(value);
}

export function formatRange(low: number, high: number) {
  return `${formatEur(low)} – ${formatEur(high)}`;
}

export function formatDate(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' }).format(timestamp);
}

export const CONDITION_LABELS: Record<string, string> = {
  mint: 'Come nuovo',
  excellent: 'Ottimo',
  good: 'Buono',
  fair: 'Discreto',
  poor: 'Scarso',
  unknown: 'Non valutabile',
};

export const MATCH_LABELS: Record<string, string> = {
  exact_model: 'Stesso modello',
  same_family: 'Stessa famiglia',
  same_brand: 'Stessa marca',
  similar_category: 'Categoria simile',
};

export const DEMAND_LABELS: Record<string, string> = {
  high: 'alta',
  medium: 'media',
  low: 'bassa',
  unknown: 'non determinata',
};

export const LIQUIDITY_LABELS: Record<string, string> = {
  fast: 'si vende in fretta',
  average: 'tempi medi',
  slow: 'rivendita lenta',
  unknown: 'non determinata',
};

export const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Confidenza alta',
  medium: 'Confidenza media',
  low: 'Confidenza bassa',
};
