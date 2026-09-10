import type { Recommendation } from '@/schemas/analysis';
import type { AuthenticityLevel } from '@/schemas/identification';

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

/**
 * Quanta evidenza sostiene l'attribuzione. Nessuna di queste parole dice
 * "autentico" o "falso", e non e' una svista: da una foto non si stabilisce,
 * e la scala misura l'evidenza, non il pezzo.
 */
export const AUTHENTICITY_LABELS: Record<AuthenticityLevel, string> = {
  none: 'Niente da cui partire',
  weak: 'Indizi deboli',
  consistent: 'Coerente, ma niente lo prova',
  strong: 'Elementi verificabili',
};

/**
 * Tacche piene sulla barra a quattro passi. La quarta non si accende mai, ed
 * e' voluto: una barra piena si legge come "certo", e la certezza qui non e'
 * fra le risposte disponibili.
 */
export const AUTHENTICITY_METER: Record<AuthenticityLevel, number> = {
  none: 0,
  weak: 1,
  consistent: 2,
  strong: 3,
};

/** Condivisa fra la pagina di analisi e la scheda salvata in inventario:
 * lo stesso verdetto deve leggersi identico ovunque compaia. */
export const RECOMMENDATION_STYLES: Record<Recommendation, { tone: string; label: string }> = {
  BUY: { tone: 'bg-accent-soft text-accent', label: 'Compralo' },
  // "Forse" non e' un'istruzione: descrive il nostro stato d'animo, non
  // quello che dovresti fare. In quella fascia c'e' un'azione precisa, ed
  // e' trattare sul prezzo. L'enum Postgres resta MAYBE: qui cambia solo
  // la parola che legge chi e' davanti al banco.
  MAYBE: { tone: 'bg-warn-soft text-warn', label: 'Tratta' },
  PASS: { tone: 'bg-danger-soft text-danger', label: 'Lascia stare' },
};

/** Variante per quando il verdetto compare dentro un blocco gia' verde
 * (il cartellino del prezzo): il tono "soft" di RECOMMENDATION_STYLES
 * sparirebbe su quello sfondo, specialmente BUY su BUY. bg-tile-cream
 * invece di bg-background: fisso fra i temi, come il blocco che lo ospita. */
export const RECOMMENDATION_STYLES_ON_VIVID: Record<Recommendation, { tone: string; label: string }> = {
  BUY: { tone: 'bg-tile-cream text-accent', label: 'Compralo' },
  MAYBE: { tone: 'bg-tile-cream text-warn', label: 'Tratta' },
  PASS: { tone: 'bg-tile-cream text-danger', label: 'Lascia stare' },
};
