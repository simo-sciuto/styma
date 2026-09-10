import type { PriceThresholds, Valuation, WeightedComparable } from '@/schemas/analysis';

/**
 * Lo stesso oggetto, comprabile adesso sotto il tuo prezzo massimo.
 *
 * Non e' una funzione nuova che chiama qualcosa: e' una lettura diversa di
 * dati che avevamo gia' in mano e usavamo per una cosa sola. Per stimare un
 * oggetto interroghiamo cinque mercati eBay e ci tornano decine di inserzioni
 * vive; le usiamo per calcolare una mediana e poi le mostriamo come prova.
 * Ma ognuna di quelle righe e' anche un oggetto che si puo' comprare, e
 * alcune stanno sotto la cifra che abbiamo appena detto essere il massimo
 * conveniente. Quello e' un affare, e finora non lo diceva nessuno.
 *
 * I filtri sono stretti apposta, perche' l'errore possibile qui e' costoso:
 * mandare qualcuno a comprare un oggetto diverso da quello che crede.
 *
 * - **Solo `used`.** I comparabili scartati sono stati scartati per un
 *   motivo — accessorio, ricambio, prezzo fuori scala — e sono esattamente
 *   le righe che un elenco di occasioni attirerebbe per prime, perche' costano
 *   poco. Ripescarle qui rifarebbe da capo il lavoro di `looksLikeAccessory`
 *   al contrario.
 * - **Solo `exact_model`.** Un comparabile «stessa marca» va benissimo per
 *   dare un ordine di grandezza a una stima, e non va affatto bene come
 *   suggerimento d'acquisto: quello e' un altro oggetto.
 * - **Solo `asking`.** Un prezzo fisso lo compri adesso. Un'asta aperta e' un
 *   pavimento su una gara che non e' finita — la stessa ragione per cui non
 *   entra nella stima — e mostrarla come occasione vorrebbe dire promettere un
 *   prezzo che non esiste ancora.
 *
 * Il confronto si fa sul prezzo sbarcato quando lo conosciamo. Un oggetto a
 * 40 € con 15 € di spedizione non e' un'occasione da 40 €, e la spedizione la
 * sappiamo per certo solo sulle inserzioni del mercato italiano.
 */
export type Deal = {
  comparable: WeightedComparable['comparable'];
  /** Il prezzo dell'inserzione, in euro. */
  priceEur: number;
  /** Prezzo piu' spedizione, quando la spedizione verso l'Italia e' nota. */
  landedEur: number | null;
  /** Su quale delle due cifre e' stato fatto il confronto. */
  comparedEur: number;
  /** Quanto sta sotto il prezzo massimo consigliato. */
  underByEur: number;
};

/** Oltre tre diventa un catalogo, e un catalogo non e' una segnalazione. */
const MAX_DEALS = 3;

export function findDeals(
  valuation: Valuation,
  thresholds: PriceThresholds,
  limit: number = MAX_DEALS,
): Deal[] {
  if (!valuation.available) return [];

  const { buyUpTo } = thresholds;
  if (buyUpTo === null) return [];

  const deals: Deal[] = [];

  for (const item of valuation.used) {
    const { comparable } = item;
    if (comparable.matchLevel !== 'exact_model') continue;
    if (comparable.kind !== 'asking') continue;

    const shipping = comparable.shippingToItalyEur;
    const landedEur =
      shipping !== null && shipping !== undefined
        ? Math.round((item.priceEur + shipping) * 100) / 100
        : null;
    const comparedEur = landedEur ?? item.priceEur;
    if (comparedEur > buyUpTo) continue;

    deals.push({
      comparable,
      priceEur: item.priceEur,
      landedEur,
      comparedEur,
      underByEur: Math.round((buyUpTo - comparedEur) * 100) / 100,
    });
  }

  // Il piu' conveniente per primo. A parita' vince quello di cui conosciamo
  // anche la spedizione: e' l'unico dei due su cui il totale e' un fatto.
  deals.sort((a, b) => a.comparedEur - b.comparedEur || (a.landedEur === null ? 1 : -1));

  return deals.slice(0, limit);
}
