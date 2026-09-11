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

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Prezzo piu' spedizione dove la spedizione verso l'Italia e' un fatto. */
function sbarcato(item: WeightedComparable): number | null {
  const shipping = item.comparable.shippingToItalyEur;
  if (shipping === null || shipping === undefined) return null;
  return round2(item.priceEur + shipping);
}

function toDeal(item: WeightedComparable, buyUpTo: number | null): Deal {
  const landedEur = sbarcato(item);
  const comparedEur = landedEur ?? item.priceEur;
  return {
    comparable: item.comparable,
    priceEur: item.priceEur,
    landedEur,
    comparedEur,
    underByEur: buyUpTo === null ? 0 : round2(buyUpTo - comparedEur),
  };
}

/** Il piu' conveniente per primo. A parita' vince quello di cui conosciamo
 *  anche la spedizione: e' l'unico dei due su cui il totale e' un fatto. */
const perConvenienza = (a: Deal, b: Deal) =>
  a.comparedEur - b.comparedEur || (a.landedEur === null ? 1 : -1);

/**
 * Lo stesso identico modello, comprabile adesso a prezzo fisso.
 *
 * `askingPrice` e' quanto ti chiedono al banco. Serve perche' «costa meno di
 * quanto te lo stanno chiedendo» e' una segnalazione utile anche quando non e'
 * sotto il prezzo massimo: sapere che lo stesso oggetto si trova online a
 * venti euro in meno cambia la trattativa comunque.
 */
export function findDeals(
  valuation: Valuation,
  thresholds: PriceThresholds,
  askingPrice: number | null = null,
  limit: number = MAX_DEALS,
): Deal[] {
  if (!valuation.available) return [];

  const { buyUpTo } = thresholds;
  // Senza nessuno dei due riferimenti non esiste la parola «occasione»: un
  // elenco di prezzi non confrontato con niente e' solo un altro elenco.
  if (buyUpTo === null && askingPrice === null) return [];

  const deals = valuation.used
    .filter(
      (item) =>
        item.comparable.matchLevel === 'exact_model' && item.comparable.kind === 'asking',
    )
    .map((item) => toDeal(item, buyUpTo))
    .filter(
      (deal) =>
        (buyUpTo !== null && deal.comparedEur <= buyUpTo) ||
        (askingPrice !== null && deal.comparedEur < askingPrice),
    );

  deals.sort(perConvenienza);
  return deals.slice(0, limit);
}

/**
 * Oggetti *simili* in vendita: stessa marca o stessa famiglia, non lo stesso
 * modello.
 *
 * Non sono occasioni e non vanno confrontate con nessuna soglia: quella soglia
 * l'abbiamo calcolata per un altro oggetto. Servono a dare un contorno al
 * mercato, ed e' il motivo per cui stanno in un elenco a parte invece che
 * mescolate a quelle sopra.
 */
export function similarForSale(valuation: Valuation, limit: number = MAX_DEALS): Deal[] {
  if (!valuation.available) return [];

  const simili = valuation.used
    .filter(
      (item) =>
        item.comparable.kind === 'asking' &&
        (item.comparable.matchLevel === 'same_family' || item.comparable.matchLevel === 'same_brand'),
    )
    .map((item) => toDeal(item, null));

  simili.sort(perConvenienza);
  return simili.slice(0, limit);
}
