import * as z from 'zod/v4';

import type { Condition } from '@/schemas/identification';
import type { Comparable, Currency, MatchLevel } from '@/schemas/market';
import { CURRENCIES } from '@/schemas/market';
import { coreModel } from '@/lib/model-name';

/**
 * Cio' che ci serve di una inserzione eBay. Lo schema e' volutamente
 * permissivo sui campi accessori e severo su quelli che entrano nel calcolo:
 * un'inserzione senza prezzo o senza URL non e' un comparabile.
 */
export const EbayItemSummarySchema = z.object({
  title: z.string(),
  itemWebUrl: z.string(),
  /**
   * Assente sulla maggior parte delle aste: misurato su eBay IT, 18 inserzioni
   * all'asta su 20 non hanno `price`, solo `currentBidPrice`. Lo schema lo
   * pretendeva, quindi `safeParse` falliva e l'inserzione spariva senza una
   * riga di log: le aste non entravano nel campione — ne' bene ne' male — da
   * sempre, mentre il commento nel codice diceva il contrario.
   */
  price: z
    .object({
      value: z.string(),
      currency: z.string(),
    })
    .optional(),
  condition: z.string().optional(),
  conditionId: z.string().optional(),
  itemEndDate: z.string().optional(),
  /**
   * Presenti solo sulle inserzioni all'asta, e solo se la chiamata le chiede
   * col filtro `buyingOptions`. Erano gia' nella risposta e non li leggevamo:
   * l'offerta corrente entrava come `price`, indistinguibile da un prezzo
   * fisso.
   */
  buyingOptions: z.array(z.string()).optional(),
  bidCount: z.number().optional(),
  currentBidPrice: z.object({ value: z.string(), currency: z.string() }).optional(),
});

export const EbaySearchResponseSchema = z.object({
  total: z.number().optional(),
  itemSummaries: z.array(z.unknown()).optional(),
});

export type EbayItemSummary = z.infer<typeof EbayItemSummarySchema>;

/**
 * Da conditionId eBay al nostro stato di conservazione.
 * https://developer.ebay.com/devzone/finding/callref/enums/conditionIdList.html
 */
function mapCondition(item: EbayItemSummary): Condition {
  switch (item.conditionId) {
    case '1000':
    case '1500':
      return 'mint';
    case '2000':
    case '2010':
    case '2020':
    case '2030':
      return 'excellent';
    case '3000':
      return 'good';
    case '4000':
      return 'fair';
    case '5000':
    case '6000':
      return 'poor';
    case '7000':
      // "For parts or not working": non e' lo stesso oggetto in senso
      // commerciale, e il suo prezzo non dice nulla su un pezzo funzionante.
      return 'poor';
    default:
      return 'unknown';
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Quanto un'inserzione somiglia all'oggetto, dedotto dal titolo.
 *
 * I titoli eBay sono pieni di parole chiave messe li' per essere trovati, non
 * per descrivere: "Canon AE-1 A-1 F-1 cinghia compatibile" contiene marca e
 * modello ma e' una cinghia da quindici euro. Non si puo' distinguere da qui,
 * e non si finge di poterlo fare: ci pensa lo scarto dei prezzi fuori scala
 * in `services/valuation`, che quel quindici euro lo toglie perche' e' dieci
 * volte sotto il mediano.
 */
export function inferMatchLevel(
  title: string,
  brand: string | null,
  model: string | null,
): MatchLevel {
  const haystack = normalize(title);
  const hasBrand = brand !== null && brand !== '' && haystack.includes(normalize(brand));
  // Stessa ragione della query: i token della coda ("con", "fd", "50mm") non
  // compaiono quasi mai nel titolo, e pretenderli declasserebbe tutto.
  const modelTokens = model === null ? [] : normalize(coreModel(model)).split(' ').filter(Boolean);
  const hasModel = modelTokens.length > 0 && modelTokens.every((token) => haystack.includes(token));

  if (hasBrand && hasModel) return 'exact_model';
  if (hasModel) return 'same_family';
  if (hasBrand) return 'same_brand';
  return 'similar_category';
}

/**
 * Parole troppo comuni per contare come prova di pertinenza: compaiono tanto
 * su una pochette quanto su un trolley, messe li' da chi vende per farsi
 * trovare, non perche' descrivano l'oggetto.
 */
const GENERIC_TOKENS = new Set([
  'vintage', 'anni', 'anno', 'style', 'stile', 'originale', 'original',
  'nuovo', 'nuova', 'new', 'usato', 'usata', 'used', 'con', 'per', 'with',
  'from', 'della', 'delle', 'dello', 'degli', 'del', 'the', 'and',
  // Tipi di oggetto che non dicono che tipo di oggetto sia: quando il modello
  // non sa dare di meglio, pretenderli nel titolo scarterebbe tutto.
  'oggetto', 'articolo', 'item', 'pezzo', 'cosa',
]);

/**
 * Se il titolo dice che si tratta dello stesso tipo di oggetto.
 *
 * La marca da sola non basta a fare un comparabile: una polo Fred Perry e un
 * maglione Fred Perry hanno la stessa marca, la stessa etichetta nel titolo, e
 * due prezzi che non hanno niente da dirsi. Quando il modello non e' leggibile
 * — che e' la norma sull'abbigliamento — la marca e' l'unica prova che eBay
 * puo' confermare, e senza questo controllo il maglione entrerebbe nella
 * stima della polo con lo stesso peso di un'altra polo.
 *
 * Basta una parola in comune: "lampada da tavolo" contro "lampada da terra"
 * resta un comparabile ragionevole, "polo" contro "maglione" no.
 */
export function mentionsObjectType(title: string, objectType: string | null): boolean {
  const tokens = normalize(objectType ?? '')
    .split(' ')
    .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token));
  // Nessun tipo utilizzabile: non si rifiuta alla cieca cio' che non si sa
  // verificare, si lascia decidere al resto della catena.
  if (tokens.length === 0) return true;

  const haystack = normalize(title);
  return tokens.some((token) => haystack.includes(token));
}

/**
 * Se il titolo di un'inserzione ha almeno una parola in comune con la query
 * che l'ha trovata.
 *
 * Serve solo quando marca e modello non dicono nulla sull'inserzione — un
 * vaso senza punzone, una borsa senza marca — perche' in quel caso
 * `similar_category` e' l'unico livello possibile qualunque cosa eBay abbia
 * restituito. Una ricerca di "borsa" che risponde con un trolley e' un
 * errore di corrispondenza di eBay, non un comparabile debole: senza questo
 * controllo entrerebbe con lo stesso peso di uno vero, e nessun numero a
 * valle lo distinguerebbe.
 */
export function isRelevantTitle(title: string, query: string): boolean {
  const queryTokens = normalize(query)
    .split(' ')
    .filter((token) => token.length >= 4 && !GENERIC_TOKENS.has(token));
  // Niente da confrontare (query cortissima, o solo parole generiche): si
  // lascia decidere al resto della pipeline invece di rifiutare alla cieca.
  if (queryTokens.length === 0) return true;

  const haystack = normalize(title);
  return queryTokens.some((token) => haystack.includes(token));
}

function toCurrency(raw: string): Currency | null {
  return (CURRENCIES as readonly string[]).includes(raw) ? (raw as Currency) : null;
}

type Bidding = {
  bids: number;
  price: { value: string; currency: string };
  /** Ore alla chiusura, null se eBay non ha dato una data leggibile. */
  hoursLeft: number | null;
};

/**
 * Se questa inserzione e' un'asta su cui qualcuno ha gia' offerto.
 *
 * Un'asta senza offerte non conta: la base d'asta e' quanto chiede il
 * venditore, esattamente come un prezzo fisso. E' la prima offerta a
 * trasformare la cifra in qualcosa che qualcun altro ha accettato di pagare.
 */
export function readBidding(item: EbayItemSummary, now: number = Date.now()): Bidding | null {
  const bids = item.bidCount ?? 0;
  const price = item.currentBidPrice ?? item.price;
  if (bids <= 0 || !price || !(item.buyingOptions ?? []).includes('AUCTION')) return null;

  const end = item.itemEndDate ? Date.parse(item.itemEndDate) : NaN;
  return {
    bids,
    price,
    hoursLeft: Number.isNaN(end) ? null : Math.max(0, (end - now) / 3_600_000),
  };
}

/** Quanto manca e quanti hanno offerto: le due cose che dicono quanto pesa quell'offerta. */
function describeBidding(bidding: Bidding | null): string {
  if (!bidding) return '';
  const offerte = bidding.bids === 1 ? '1 offerta' : `${bidding.bids} offerte`;
  if (bidding.hoursLeft === null) return `Asta in corso, ${offerte}`;
  if (bidding.hoursLeft < 1) return `Asta in chiusura, ${offerte}`;
  if (bidding.hoursLeft < 48) return `Asta, ${offerte}, chiude fra ${Math.round(bidding.hoursLeft)}h`;
  return `Asta, ${offerte}, chiude fra ${Math.round(bidding.hoursLeft / 24)} giorni`;
}

/**
 * Da inserzione eBay a comparabile.
 *
 * `kind` non e' mai "sold": la Browse API restituisce inserzioni attive. I
 * venduti stanno nella Marketplace Insights API, chiusa ai nuovi utenti.
 * Dichiararli "sold" perche' vengono da eBay sarebbe la bugia piu' facile e
 * piu' costosa da fare qui.
 *
 * Ma non sono nemmeno tutti "asking". Un'asta con almeno un'offerta porta una
 * cifra di natura diversa — soldi che qualcuno ha impegnato davvero — e va
 * distinta: vedi `PRICE_KINDS`. Un'asta senza offerte resta `asking`, perche'
 * la base d'asta e' esattamente quello: quanto chiede il venditore.
 */
/** Cio' che si sa dell'oggetto cercato, per giudicare un'inserzione trovata. */
export type ComparableContext = {
  brand: string | null;
  model: string | null;
  objectType: string | null;
  /** La query che ha trovato questa inserzione. */
  query: string;
};

export function toComparable(raw: unknown, context: ComparableContext): Comparable | null {
  const parsed = EbayItemSummarySchema.safeParse(raw);
  if (!parsed.success) return null;

  const item = parsed.data;
  const bidding = readBidding(item);

  // Su un'asta con offerte il prezzo che conta e' l'offerta corrente. Su
  // tutto il resto e' `price`. Se non c'e' ne' l'una ne' l'altro non c'e'
  // niente da confrontare.
  const source = bidding?.price ?? item.price;
  if (!source) return null;
  const price = Number(source.value);
  if (!Number.isFinite(price) || price <= 0) return null;

  const currency = toCurrency(source.currency);
  if (currency === null) return null;

  const matchLevel = inferMatchLevel(item.title, context.brand, context.model);

  // A exact_model e same_family il modello e' nel titolo: e' la prova migliore
  // che esista, e nessun controllo sul tipo la migliora.
  //
  // A same_brand c'e' solo la marca, che non dice che tipo di oggetto sia.
  // A similar_category non c'e' nemmeno quella. Sono i due livelli in cui il
  // titolo va guardato davvero, ciascuno contro cio' che si puo' verificare.
  if (matchLevel === 'same_brand' && !mentionsObjectType(item.title, context.objectType)) {
    return null;
  }
  if (matchLevel === 'similar_category' && !isRelevantTitle(item.title, context.query)) {
    return null;
  }

  return {
    title: item.title,
    source: 'eBay',
    url: item.itemWebUrl,
    price,
    currency,
    kind: bidding ? 'bid' : 'asking',
    soldAt: null,
    condition: mapCondition(item),
    matchLevel,
    notes: [describeBidding(bidding), item.condition ? `Stato dichiarato: ${item.condition}` : '']
      .filter(Boolean)
      .join(' · '),
  };
}
