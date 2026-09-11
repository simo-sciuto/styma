import type { ItemRow, ItemStatus, ValuationRow } from './types';

export type InventorySummary = {
  items: number;
  /** Quanti oggetti hanno una stima: gli altri non entrano nei totali. */
  valued: number;
  /** Somma dei valori probabili, sui soli oggetti stimati. */
  estimatedValueEur: number | null;
  /** Quanti oggetti hai davvero comprato: il prezzo pagato c'e' solo se l'hai dichiarato. */
  bought: number;
  /** Quanto e' costato quello che hai comprato davvero. */
  spentEur: number | null;
  /**
   * Quanti oggetti hai ancora in mano con sia il prezzo pagato sia una
   * stima: sono i soli su cui un margine *atteso* significhi qualcosa. I
   * venduti non entrano — su quelli il margine non e' piu' atteso, e'
   * successo, e sta in `realizedMarginEur`.
   */
  withBoth: number;
  /**
   * Margine atteso su quegli oggetti: stima meno quanto hai pagato.
   * Sommare tutte le stime e sottrarre tutte le spese darebbe un numero
   * costruito su due popolazioni diverse — piu' grande, e senza senso.
   */
  potentialMarginEur: number | null;
  /** Quanti oggetti sono stati venduti davvero. */
  sold: number;
  /** Quanti venduti hanno sia il prezzo pagato sia quello incassato. */
  soldWithBoth: number;
  /**
   * Quello che hai guadagnato davvero: incassi meno spese, sui soli oggetti
   * dove conosciamo entrambi. E' l'unico numero di questa pagina che non e'
   * una previsione.
   */
  realizedMarginEur: number | null;
  /** Quante vendite si possono confrontare con la fascia che avevamo dato. */
  checkedAgainstEstimate: number;
  /**
   * Quante di quelle sono finite dentro la fascia. E' il voto del prodotto,
   * dato dal mercato: senza, ogni stima resterebbe per sempre "plausibile".
   */
  insideEstimate: number;
  byStatus: Record<ItemStatus, number>;
};

/**
 * I totali del magazzino, da dati gia' caricati per la lista: nessuna query
 * in piu'.
 *
 * Il margine e' la differenza fra quello che incassi e quello che hai speso,
 * la stessa aritmetica del verdetto di ogni singolo oggetto: se qui uscisse da
 * un altro conto, due schermate dello stesso prodotto direbbero due cose
 * diverse sullo stesso oggetto.
 */
export function summarizeInventory(
  entries: { item: ItemRow; valuation: ValuationRow | null }[],
): InventorySummary {
  const byStatus: Record<ItemStatus, number> = {
    found: 0,
    passed: 0,
    bought: 0,
    listed: 0,
    sold: 0,
  };

  let valued = 0;
  let estimatedValueEur = 0;
  let bought = 0;
  let spentEur = 0;
  let withBoth = 0;
  let potentialMarginEur = 0;
  let sold = 0;
  let soldWithBoth = 0;
  let realizedMarginEur = 0;
  let checkedAgainstEstimate = 0;
  let insideEstimate = 0;

  for (const { item, valuation } of entries) {
    byStatus[item.status] += 1;

    const likely = valuation?.likely_value ?? null;
    const paid = item.purchase_price;
    const isSold = item.status === 'sold';

    if (likely !== null) {
      valued += 1;
      estimatedValueEur += likely;
    }
    if (paid !== null) {
      bought += 1;
      spentEur += paid;
    }
    if (likely !== null && paid !== null && !isSold) {
      withBoth += 1;
      potentialMarginEur += likely - paid;
    }

    if (isSold) {
      sold += 1;
      if (item.sale_price !== null && paid !== null) {
        soldWithBoth += 1;
        realizedMarginEur += item.sale_price - paid;
      }
      if (
        item.sale_price !== null &&
        valuation?.low_value != null &&
        valuation.high_value != null
      ) {
        checkedAgainstEstimate += 1;
        if (item.sale_price >= valuation.low_value && item.sale_price <= valuation.high_value) {
          insideEstimate += 1;
        }
      }
    }
  }

  const round = (value: number) => Math.round(value);

  return {
    items: entries.length,
    valued,
    estimatedValueEur: valued > 0 ? round(estimatedValueEur) : null,
    bought,
    spentEur: bought > 0 ? round(spentEur) : null,
    withBoth,
    potentialMarginEur: withBoth > 0 ? round(potentialMarginEur) : null,
    sold,
    soldWithBoth,
    realizedMarginEur: soldWithBoth > 0 ? round(realizedMarginEur) : null,
    checkedAgainstEstimate,
    insideEstimate,
    byStatus,
  };
}
