import 'server-only';

import { ebayHost, getApplicationToken, getEbayConfig } from '@/services/market-data/ebay/client';
import { ListingError, MAX_LISTING_IMAGES, type SharedListing } from './types';

/**
 * Un annuncio eBay, letto dalla Browse API.
 *
 * Nessuna pagina da interpretare: le stesse credenziali con cui cerchiamo i
 * comparabili rispondono anche su un singolo annuncio, con dato ufficiale e
 * completo. La pagina web di eBay risponde 403 a un fetch da server, il che
 * dice da solo quale delle due strade e' quella giusta.
 *
 * Il marketplace lo decide il dominio del link: un annuncio di ebay.de va
 * chiesto a EBAY_DE, o l'API risponde che non esiste.
 */
const MARKETPLACE_PER_DOMINIO: Record<string, string> = {
  it: 'EBAY_IT',
  de: 'EBAY_DE',
  fr: 'EBAY_FR',
  es: 'EBAY_ES',
  'co.uk': 'EBAY_GB',
  com: 'EBAY_US',
  ie: 'EBAY_IE',
  at: 'EBAY_AT',
  ch: 'EBAY_CH',
  nl: 'EBAY_NL',
  be: 'EBAY_BE',
  pl: 'EBAY_PL',
  'com.au': 'EBAY_AU',
  ca: 'EBAY_CA',
};

export function marketplaceFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const dopo = host.replace(/^.*?ebay\./, '');
    return MARKETPLACE_PER_DOMINIO[dopo] ?? 'EBAY_IT';
  } catch {
    return 'EBAY_IT';
  }
}

type EbayItem = {
  title?: string;
  price?: { value?: string; currency?: string };
  image?: { imageUrl?: string };
  additionalImages?: { imageUrl?: string }[];
  brand?: string;
  categoryPath?: string;
  condition?: string;
  shortDescription?: string;
  itemWebUrl?: string;
};

export async function fetchEbayListing(url: string, legacyId: string): Promise<SharedListing> {
  const config = getEbayConfig();
  if (!config) {
    throw new ListingError('Gli annunci eBay non sono configurati su questo server.', 'unsupported');
  }

  let item: EbayItem;
  try {
    const token = await getApplicationToken(config);
    const endpoint = new URL(`${ebayHost(config)}/buy/browse/v1/item/get_item_by_legacy_id`);
    endpoint.searchParams.set('legacy_item_id', legacyId);

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': marketplaceFromUrl(url),
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (response.status === 404) {
      throw new ListingError('Questo annuncio non esiste piu’ su eBay.', 'not_found');
    }
    if (!response.ok) {
      throw new ListingError('eBay non ci ha fatto leggere questo annuncio.', 'unreachable');
    }
    item = (await response.json()) as EbayItem;
  } catch (caught) {
    if (caught instanceof ListingError) throw caught;
    console.error('[listings] lettura eBay fallita', caught);
    throw new ListingError('eBay non risponde. Riprova fra poco.', 'unreachable');
  }

  if (!item.title) {
    throw new ListingError('Questo annuncio eBay non si lascia leggere.', 'unreadable');
  }

  const imageUrls = [item.image?.imageUrl, ...(item.additionalImages ?? []).map((i) => i.imageUrl)]
    .filter((src): src is string => typeof src === 'string' && src.length > 0)
    .slice(0, MAX_LISTING_IMAGES);

  if (imageUrls.length === 0) {
    throw new ListingError('Questo annuncio non ha foto da guardare.', 'no_photos');
  }

  const prezzo = Number(item.price?.value);
  const inEuro = item.price?.currency === 'EUR' && Number.isFinite(prezzo) && prezzo > 0;

  return {
    source: 'ebay',
    url: item.itemWebUrl ?? url,
    title: item.title,
    priceEur: inEuro ? prezzo : null,
    brand: item.brand ?? null,
    // «Arte e antiquariato|Attrezzi|Attrezzi da scrittura» e' l'albero
    // completo: a chi legge serve l'ultima foglia.
    category: item.categoryPath?.split('|').pop()?.trim() ?? null,
    condition: item.condition ?? null,
    description: item.shortDescription ? item.shortDescription.slice(0, 400) : null,
    imageUrls,
  };
}
