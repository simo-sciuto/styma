import type { ItemRow, ValuationRow } from './types';

/**
 * Com'e' andata davvero, contro cio' che avevamo detto.
 *
 * E' l'unica parte del prodotto che puo' smentirci. Tutto il resto —
 * fascia, punteggio, verdetto — e' una previsione, e una previsione che
 * nessuno verifica non e' mai sbagliata. Qui si confronta il prezzo che il
 * mercato ha davvero pagato con la fascia che avevamo stimato, e se la stima
 * era fuori si dice.
 *
 * Tutte le funzioni di questo file sono pure: `now` si passa, non si legge.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dove e' caduto il prezzo di vendita rispetto alla fascia che avevamo dato. */
export type RangeVerdict = 'below' | 'inside' | 'above';

export type SoldOutcome = {
  kind: 'sold';
  askingPrice: number | null;
  purchasePrice: number | null;
  /** Quanto hai strappato trattando. Null se non sappiamo entrambi i prezzi. */
  negotiated: number | null;
  salePrice: number;
  marketplace: string | null;
  /**
   * Il guadagno: incasso meno quanto l'oggetto ti e' costato in tutto, prezzo
   * di acquisto piu' quello che ci hai speso sopra. Sono cifre che hai
   * digitato tu: e' l'unico numero interamente verificabile di questa pagina.
   */
  grossMargin: number | null;
  /** Quanto ci hai speso oltre il prezzo, se l'hai dichiarato. */
  extraCosts: number | null;
  extraCostsNote: string | null;
  /** Giorni dall'acquisto alla vendita. */
  daysHeld: number | null;
  /** Giorni passati in vendita: da quando l'hai messo online. */
  daysOnMarket: number | null;
  /** Come e' andata la nostra stima, se ce n'era una. */
  vsEstimate: { verdict: RangeVerdict; low: number; high: number; likely: number | null } | null;
};

export type Outcome =
  /** Analizzato e basta: non hai ancora detto se l'hai preso. */
  | { kind: 'open' }
  /** Hai lasciato perdere. E' una decisione registrata, non un vuoto. */
  | { kind: 'passed'; askingPrice: number | null }
  /** Comprato, non ancora venduto. */
  | {
      kind: 'holding';
      askingPrice: number | null;
      purchasePrice: number | null;
      /** Quanto ci hai speso oltre il prezzo, se l'hai dichiarato. */
      extraCosts: number | null;
      extraCostsNote: string | null;
      negotiated: number | null;
      listed: boolean;
      daysHeld: number | null;
      daysOnMarket: number | null;
      /**
       * Il valore atteso della stima, per dire quanto ci guadagni se lo vendi.
       * Mentre ce l'hai in magazzino e' l'unica cifra che guarda avanti: tutte
       * le altre dicono cos'e' gia' successo.
       */
      likelyValue: number | null;
    }
  | SoldOutcome;

/** Giorni pieni fra due date, `null` se una delle due manca o non e' leggibile. */
export function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

function isoDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function compareToRange(
  salePrice: number,
  valuation: ValuationRow | null,
): SoldOutcome['vsEstimate'] {
  if (!valuation || valuation.low_value === null || valuation.high_value === null) return null;
  const { low_value: low, high_value: high } = valuation;
  const verdict: RangeVerdict = salePrice < low ? 'below' : salePrice > high ? 'above' : 'inside';
  return { verdict, low, high, likely: valuation.likely_value };
}

export function describeOutcome(
  item: ItemRow,
  valuation: ValuationRow | null,
  now: number = Date.now(),
): Outcome {
  const asking = item.asking_price;
  const paid = item.purchase_price;
  // Quanto hai strappato trattando: la differenza resta col suo segno, e sta
  // a chi la mostra decidere se vale la pena dirla. Zero e' un esito vero
  // ("non hai trattato"), non un dato mancante.
  const negotiated = asking !== null && paid !== null ? asking - paid : null;

  if (item.status === 'passed') {
    return { kind: 'passed', askingPrice: asking };
  }

  // Quanto l'oggetto e' costato in tutto. Il prezzo di acquisto da solo
  // faceva sembrare ogni margine piu' alto di quanto fosse: la pulizia e i
  // ricambi escono dalla stessa tasca.
  const extra = item.extra_costs;
  const costoTotale = paid === null ? null : paid + (extra ?? 0);

  if (item.status === 'sold' && item.sale_price !== null) {
    const grossMargin = costoTotale !== null ? item.sale_price - costoTotale : null;
    return {
      kind: 'sold',
      askingPrice: asking,
      purchasePrice: paid,
      extraCosts: extra,
      extraCostsNote: item.extra_costs_note,
      negotiated,
      salePrice: item.sale_price,
      marketplace: item.marketplace,
      grossMargin,
      daysHeld: daysBetween(item.purchase_date, item.sale_date),
      daysOnMarket: daysBetween(item.listed_at, item.sale_date),
      vsEstimate: compareToRange(item.sale_price, valuation),
    };
  }

  if (item.status === 'bought' || item.status === 'listed') {
    const today = isoDay(now);
    return {
      kind: 'holding',
      askingPrice: asking,
      purchasePrice: paid,
      extraCosts: extra,
      extraCostsNote: item.extra_costs_note,
      negotiated,
      listed: item.status === 'listed',
      daysHeld: daysBetween(item.purchase_date, today),
      daysOnMarket: daysBetween(item.listed_at, today),
      likelyValue: valuation?.likely_value ?? null,
    };
  }

  return { kind: 'open' };
}
