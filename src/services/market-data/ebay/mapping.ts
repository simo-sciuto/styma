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
  price: z.object({
    value: z.string(),
    currency: z.string(),
  }),
  condition: z.string().optional(),
  conditionId: z.string().optional(),
  itemEndDate: z.string().optional(),
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

/**
 * Da inserzione eBay a comparabile.
 *
 * `kind` e' sempre "asking": la Browse API restituisce inserzioni attive, cioe'
 * prezzi richiesti. I venduti stanno nella Marketplace Insights API, che ha
 * accesso separato. Dichiararli "sold" perche' vengono da eBay sarebbe la
 * bugia piu' facile e piu' costosa da fare qui.
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
  const price = Number(item.price.value);
  if (!Number.isFinite(price) || price <= 0) return null;

  const currency = toCurrency(item.price.currency);
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
    kind: 'asking',
    soldAt: null,
    condition: mapCondition(item),
    matchLevel,
    notes: item.condition ? `Stato dichiarato: ${item.condition}` : '',
  };
}
