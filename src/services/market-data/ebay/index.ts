import type { Identification } from '@/schemas/identification';
import type { Comparable } from '@/schemas/market';
import { EbayError, ebayHost, getApplicationToken, getEbayConfig } from './client';
import { EbaySearchResponseSchema, toComparable } from './mapping';
import { buildQueries } from './queries';

export { buildQueries, buildQuery, ebaySoldSearchUrl } from './queries';

/**
 * Mercati interrogati, in ordine di rilevanza per un rivenditore italiano.
 * L'estero serve a capire se il prezzo italiano e' allineato, e su oggetti
 * di nicchia spesso e' l'unico posto dove ci sono inserzioni.
 */
const MARKETPLACES = ['EBAY_IT', 'EBAY_DE', 'EBAY_GB', 'EBAY_ES', 'EBAY_FR'] as const;

/** Oltre questo numero per mercato si aggiungono solo doppioni della stessa inserzione. */
const LIMIT_PER_MARKETPLACE = 20;

/** Oltre questo numero non si allarga: le query dopo sono piu' vaghe. */
const ENOUGH_FROM_ONE_QUERY = 8;

/** Tetto ai tentativi: senza, un oggetto introvabile costerebbe otto giri. */
const MAX_QUERIES = 3;

/**
 * Quante aste con offerte tenere. Non entrano nella stima — sono un pavimento,
 * non un prezzo — quindi ne bastano poche, le piu' alte: servono a dire fin
 * dove qualcuno si e' gia' spinto, non a fare una media. Tenerle tutte
 * significherebbe novanta righe scartate in pagina e novanta righe nel
 * database per ogni analisi.
 */
const AUCTIONS_KEPT = 5;

async function searchMarketplace(
  host: string,
  token: string,
  marketplace: string,
  query: string,
  identification: Identification,
  buyingOptions = 'FIXED_PRICE|AUCTION',
): Promise<Comparable[]> {
  const url = new URL(`${host}/buy/browse/v1/item_summary/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(LIMIT_PER_MARKETPLACE));
  url.searchParams.set('filter', `buyingOptions:{${buyingOptions}}`);

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
    .map((item) =>
      toComparable(item, {
        brand: identification.brand,
        model: identification.model,
        objectType: identification.objectType,
        query,
        marketplace,
      }),
    )
    .filter((comparable): comparable is Comparable => comparable !== null);
}

/**
 * Un giro dedicato alle aste, perche' la ricerca normale non le mostra.
 *
 * Misurato su "canon ae-1", cinque mercati: chiedendo prezzo fisso e aste
 * insieme tornano 24 aste su 250 risultati, di cui 12 con offerte; chiedendo
 * solo aste ne tornano 213, di cui 91 con offerte. La rilevanza di eBay mette
 * il prezzo fisso davanti, e il nostro limite per mercato taglia via quasi
 * tutto il resto: il segnale c'era e non lo vedevamo.
 *
 * Serve a una cosa sola, ed e' il motivo per cui ne bastano cinque: dire fin
 * dove qualcuno si e' gia' spinto davvero. Nella stima non entrano — un'offerta
 * a meta' corsa non e' un prezzo di vendita, vedi `valuation/comparables.ts`.
 */
async function searchAuctions(
  host: string,
  token: string,
  query: string,
  identification: Identification,
): Promise<Comparable[]> {
  const settled = await Promise.allSettled(
    MARKETPLACES.map((marketplace) =>
      searchMarketplace(host, token, marketplace, query, identification, 'AUCTION'),
    ),
  );

  const bids = settled
    .flatMap((outcome) => (outcome.status === 'fulfilled' ? outcome.value : []))
    .filter((comparable) => comparable.kind === 'bid')
    .sort((a, b) => b.price - a.price);

  if (bids.length > 0) {
    console.info(`[ebay] ${bids.length} aste con offerte, tengo le ${AUCTIONS_KEPT} piu' alte`);
  }
  return bids.slice(0, AUCTIONS_KEPT);
}

export type EbayOutcome = {
  comparables: Comparable[];
  /** Mercati che hanno risposto, per poter dire su cosa poggia il risultato. */
  marketplaces: string[];
  /** Query effettivamente usate: serve a capire perche' un risultato e' vago. */
  queries: string[];
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

  const queries = buildQueries(identification);
  if (queries.length === 0) return null;

  const token = await getApplicationToken(config);
  const host = ebayHost(config);

  const comparables: Comparable[] = [];
  const marketplaces = new Set<string>();
  const used: string[] = [];

  // Si prova una query alla volta e ci si ferma appena il campione basta:
  // le query successive sono via via piu' vaghe, e allargare quando non serve
  // peggiora la qualita' dei comparabili invece di migliorarla.
  for (const query of queries.slice(0, MAX_QUERIES)) {
    const settled = await Promise.allSettled(
      MARKETPLACES.map((marketplace) =>
        searchMarketplace(host, token, marketplace, query, identification).then((found) => ({
          marketplace,
          found,
        })),
      ),
    );

    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') {
        console.warn('[ebay] un mercato non ha risposto', outcome.reason);
        continue;
      }
      comparables.push(...outcome.value.found);
      marketplaces.add(outcome.value.marketplace);
    }

    used.push(query);
    if (comparables.length >= ENOUGH_FROM_ONE_QUERY) break;
  }

  if (used.length > 1) {
    console.info(`[ebay] ${used.length} query provate: ${used.map((q) => `"${q}"`).join(', ')}`);
  }

  comparables.push(...(await searchAuctions(host, token, queries[0]!, identification)));

  return { comparables, marketplaces: [...marketplaces], queries: used };
}
