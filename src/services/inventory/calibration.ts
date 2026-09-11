import type { ItemRow, ValuationRow } from './types';

/**
 * Quanto le tue vendite si discostano dalle nostre stime.
 *
 * E' il solo numero di questo prodotto che non possiamo calcolare da soli e
 * che nessun concorrente puo' copiare, perche' non descrive il mercato:
 * descrive *te*. Il tuo mercatino, i tuoi acquirenti, la tua fretta di
 * vendere, il canale che usi.
 *
 * Nasce da un limite dichiarato. La stima poggia su prezzi *richiesti*, non
 * su vendite concluse, perche' una fonte lecita di venduti non esiste: sta
 * scritto in AGENTS.md e resta vero. Chi rivende lo sa e applica una
 * correzione a mente, ogni volta, a occhio. Dopo qualche vendita vera pero'
 * la correzione non e' piu' a occhio: e' un dato che abbiamo raccolto noi,
 * senza chiedere niente in piu' a nessuno.
 *
 * La mediana e non la media: una singola vendita fortunata a tre volte la
 * stima sposterebbe una media e non sposta una mediana, ed e' giusto cosi'.
 * Un colpo di fortuna non e' una correzione da applicare alla prossima stima.
 */
export type Calibration =
  | {
      enough: true;
      /** Quante vendite hanno sia il prezzo incassato sia una stima con cui confrontarlo. */
      sales: number;
      /** Mediana di prezzo incassato / valore stimato. 0,74 = chiudi al 74%. */
      ratio: number;
      /** Il piu' basso e il piu' alto osservati, per non far sembrare la mediana una legge. */
      lowest: number;
      highest: number;
    }
  | { enough: false; sales: number; needed: number };

/**
 * Sotto le cinque vendite la mediana e' rumore, e un numero costruito su due
 * vendite convincerebbe piu' di quanto vale. Meglio dire quante ne mancano.
 */
export const MIN_SALES = 5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function calibrate(
  entries: { item: ItemRow; valuation: ValuationRow | null }[],
): Calibration {
  const ratios: number[] = [];

  for (const { item, valuation } of entries) {
    if (item.status !== 'sold') continue;
    if (item.sale_price === null || item.sale_price <= 0) continue;

    const likely = valuation?.likely_value ?? null;
    if (likely === null || likely <= 0) continue;

    ratios.push(item.sale_price / likely);
  }

  if (ratios.length < MIN_SALES) {
    return { enough: false, sales: ratios.length, needed: MIN_SALES - ratios.length };
  }

  const round2 = (value: number) => Math.round(value * 100) / 100;

  return {
    enough: true,
    sales: ratios.length,
    ratio: round2(median(ratios)),
    lowest: round2(Math.min(...ratios)),
    highest: round2(Math.max(...ratios)),
  };
}

/**
 * La stima riportata al tuo metro. Non sostituisce la fascia: le sta accanto,
 * perche' sono due cose diverse e vanno lette come due cose diverse.
 */
export function atYourRate(valueEur: number, calibration: Calibration): number | null {
  if (!calibration.enough) return null;
  return Math.round(valueEur * calibration.ratio);
}
