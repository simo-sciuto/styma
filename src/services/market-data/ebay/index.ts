import type { Identification } from '@/schemas/identification';
import type { Comparable } from '@/schemas/market';
import { coreModel } from '@/lib/model-name';
import { EbayError, ebayHost, getApplicationToken, getEbayConfig } from './client';
import { EbaySearchResponseSchema, toComparable } from './mapping';

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
 * Le query da provare, in ordine di precisione.
 *
 * Marca e modello sono i due campi su cui i titoli eBay sono affidabili, ma
 * meta' degli oggetti di un mercatino non ha ne' l'una ne' l'altro: un vaso
 * senza punzone, una lampada anonima. Per quelli l'identificazione produce
 * gia' `searchQueries`, scritte apposta per cercare comparabili — usarne una
 * sola, o ripiegarci solo quando marca e modello mancano entrambi, buttava via
 * l'unico appiglio disponibile.
 *
 * Provarne piu' di una non costa niente: eBay non si paga a chiamata.
 */
export function buildQueries(identification: Identification): string[] {
  const queries: string[] = [];
  const brand = identification.brand?.trim();
  // Senza tagliare la coda, "Canon AE-1 con FD 50mm f/1.8" trova una
  // inserzione su undicimila: la ricerca cerca la frase, non l'oggetto.
  const model = identification.model === null ? null : coreModel(identification.model);

  if (brand && model) {
    // "Morenita Morenita Express" cercava la marca due volte: se il modello la
    // contiene gia', ripeterla restringe senza aggiungere nulla.
    const modelHasBrand = model.toLowerCase().includes(brand.toLowerCase());
    queries.push(modelHasBrand ? model : `${brand} ${model}`);
  } else if (model) {
    queries.push(model);
  } else if (brand) {
    // La sola marca e' troppo larga per essere una query: si accompagna a cio'
    // che il modello ha capito dell'oggetto.
    queries.push(`${brand} ${identification.category}`.trim());
  }

  queries.push(...identification.searchQueries.map((query) => query.trim()));

  const seen = new Set<string>();
  return queries.filter((query) => {
    const key = query.toLowerCase();
    if (query.length < 3 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Compatibilita': la prima query e' quella piu' precisa. */
export function buildQuery(identification: Identification): string | null {
  return buildQueries(identification)[0] ?? null;
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

  return { comparables, marketplaces: [...marketplaces], queries: used };
}
