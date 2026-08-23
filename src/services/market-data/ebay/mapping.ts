import * as z from 'zod/v4';

import type { Condition } from '@/schemas/identification';
import type { Comparable, Currency, MatchLevel } from '@/schemas/market';
import { CURRENCIES } from '@/schemas/market';

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
  const modelTokens = model === null ? [] : normalize(model).split(' ').filter(Boolean);
  const hasModel = modelTokens.length > 0 && modelTokens.every((token) => haystack.includes(token));

  if (hasBrand && hasModel) return 'exact_model';
  if (hasModel) return 'same_family';
  if (hasBrand) return 'same_brand';
  return 'similar_category';
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
export function toComparable(
  raw: unknown,
  brand: string | null,
  model: string | null,
): Comparable | null {
  const parsed = EbayItemSummarySchema.safeParse(raw);
  if (!parsed.success) return null;

  const item = parsed.data;
  const price = Number(item.price.value);
  if (!Number.isFinite(price) || price <= 0) return null;

  const currency = toCurrency(item.price.currency);
  if (currency === null) return null;

  return {
    title: item.title,
    source: 'eBay',
    url: item.itemWebUrl,
    price,
    currency,
    kind: 'asking',
    soldAt: null,
    condition: mapCondition(item),
    matchLevel: inferMatchLevel(item.title, brand, model),
    notes: item.condition ? `Stato dichiarato: ${item.condition}` : '',
  };
}
