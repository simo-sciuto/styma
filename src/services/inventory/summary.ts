import type { ItemRow, ItemStatus, ValuationRow } from './types';
import { flipConfig } from '@/services/valuation/config';

export type InventorySummary = {
  items: number;
  /** Quanti oggetti hanno una stima: gli altri non entrano nei totali. */
  valued: number;
  /** Somma dei valori probabili, sui soli oggetti stimati. */
  estimatedValueEur: number | null;
  /** Quanti oggetti hanno un prezzo di acquisto registrato. */
  bought: number;
  /** Quanto e' costato quello che hai comprato davvero. */
  spentEur: number | null;
  /**
   * Quanti oggetti hanno sia il prezzo pagato sia una stima: sono i soli
   * su cui un margine significhi qualcosa.
   */
  withBoth: number;
  /**
   * Margine atteso su quegli oggetti, al netto di commissioni e spedizione.
   * Sommare tutte le stime e sottrarre tutte le spese darebbe un numero
   * costruito su due popolazioni diverse — piu' grande, e senza senso.
   */
  potentialMarginEur: number | null;
  byStatus: Record<ItemStatus, number>;
};

/**
 * I totali del magazzino, da dati gia' caricati per la lista: nessuna query
 * in piu'.
 *
 * Commissioni e spedizione escono da `flipConfig`, gli stessi numeri con cui
 * si calcola il verdetto di ogni singolo oggetto: se il margine qui uscisse
 * da un'altra aritmetica, due schermate dello stesso prodotto direbbero due
 * cose diverse sullo stesso oggetto.
 */
export function summarizeInventory(
  entries: { item: ItemRow; valuation: ValuationRow | null }[],
): InventorySummary {
  const byStatus: Record<ItemStatus, number> = { found: 0, bought: 0, listed: 0, sold: 0 };

  let valued = 0;
  let estimatedValueEur = 0;
  let bought = 0;
  let spentEur = 0;
  let withBoth = 0;
  let potentialMarginEur = 0;

  for (const { item, valuation } of entries) {
    byStatus[item.status] += 1;

    const likely = valuation?.likely_value ?? null;
    const paid = item.purchase_price;

    if (likely !== null) {
      valued += 1;
      estimatedValueEur += likely;
    }
    if (paid !== null) {
      bought += 1;
      spentEur += paid;
    }
    if (likely !== null && paid !== null) {
      withBoth += 1;
      potentialMarginEur +=
        likely - paid - likely * flipConfig.marketplaceFeeRate - flipConfig.defaultShippingCost;
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
    byStatus,
  };
}
