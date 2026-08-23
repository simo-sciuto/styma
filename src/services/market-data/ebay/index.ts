import type { Identification } from '@/schemas/identification';
import type { Comparable } from '@/schemas/market';
import { EbayError, ebayHost, getApplicationToken, getEbayConfig } from './client';
import { EbaySearchResponseSchema, toComparable } from './mapping';

/**
 * Mercati interrogati, in ordine di rilevanza per un rivenditore italiano.
 * L'estero serve a capire se il prezzo italiano e' allineato, e su oggetti
 * di nicchia spesso e' l'unico posto dove ci sono inserzioni.
 */
const MARKETPLACES = ['EBAY_IT', 'EBAY_DE', 'EBAY_GB'] as const;

/** Oltre questo numero per mercato si aggiungono solo doppioni della stessa inserzione. */
const LIMIT_PER_MARKETPLACE = 20;

/**
 * Query di ricerca. Marca e modello quando ci sono: sono i due campi su cui
 * i titoli eBay sono affidabili. Il nome libero e' l'ultima risorsa, perche'
 * contiene descrizioni ("rossa", "con valigetta") che restringono a caso.
 */
export function buildQuery(identification: Identification): string | null {
  const brand = identification.brand?.trim();
  const model = identification.model?.trim();
  if (brand && model) return `${brand} ${model}`;
  if (brand) return brand;
  if (model) return model;

  const fallback = identification.searchQueries[0]?.trim();
  return fallback && fallback.length > 0 ? fallback : null;
}

async function searchMarketplace(
  host: string,
  token: string,
  marketplace: string,
  query: string,
  identification: Identification,
): Promise<Comparable[]> {
  const url = new URL(`${host}/buy/browse/v1/item_summary/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(LIMIT_PER_MARKETPLACE));
  // Aste e prezzo fisso insieme: escludere le aste toglierebbe proprio i
  // prezzi che si avvicinano di piu' a una vendita reale.
  url.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE|AUCTION}');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': marketplace,
    },
  });

  if (!response.ok) {
    throw new EbayError(`Ricerca eBay fallita su ${marketplace} (${response.status})`, response.status);
  }

  const parsed = EbaySearchResponseSchema.safeParse(await response.json());
  if (!parsed.success) return [];

  return (parsed.data.itemSummaries ?? [])
    .map((item) => toComparable(item, identification.brand, identification.model))
    .filter((comparable): comparable is Comparable => comparable !== null);
}

export type EbayOutcome = {
  comparables: Comparable[];
  /** Mercati che hanno risposto, per poter dire su cosa poggia il risultato. */
  marketplaces: string[];
};

/**
 * Cerca su eBay i comparabili per un oggetto.
 *
 * Un mercato che fallisce non ferma gli altri: meno dati sono comunque dati,
 * e la valutazione a valle sa gia' dichiarare un campione piccolo. Null solo
 * quando eBay non e' configurato del tutto, cosi' il chiamante sa che deve
 * ripiegare sulla ricerca col modello.
 */
export async function searchEbay(identification: Identification): Promise<EbayOutcome | null> {
  const config = getEbayConfig();
  if (!config) return null;

  const query = buildQuery(identification);
  if (query === null) return null;

  const token = await getApplicationToken(config);
  const host = ebayHost(config);

  const settled = await Promise.allSettled(
    MARKETPLACES.map((marketplace) =>
      searchMarketplace(host, token, marketplace, query, identification).then((comparables) => ({
        marketplace,
        comparables,
      })),
    ),
  );

  const comparables: Comparable[] = [];
  const marketplaces: string[] = [];

  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') {
      console.warn('[ebay] un mercato non ha risposto', outcome.reason);
      continue;
    }
    comparables.push(...outcome.value.comparables);
    marketplaces.push(outcome.value.marketplace);
  }

  return { comparables, marketplaces };
}
