import 'server-only';

import type { ImageInput } from '@/services/ai';
import { fetchEbayListing } from './ebay';
import { parseListingUrl } from './parse';
import { ListingError, type SharedListing } from './types';
import { fetchVintedListing } from './vinted';

export { parseListingUrl, sellerQuery, SOURCE_LABELS, type ListingSource } from './parse';
export { ListingError, MAX_LISTING_IMAGES, type SharedListing } from './types';

/**
 * Da un link a un annuncio leggibile, qualunque sia la piattaforma.
 *
 * Un link non riconosciuto si rifiuta subito e con una frase che dice cosa
 * fare: quali piattaforme sappiamo leggere e' un'informazione utile, «link non
 * valido» non lo e'.
 */
export async function fetchListing(raw: string): Promise<SharedListing> {
  const parsed = parseListingUrl(raw);
  if (!parsed) {
    throw new ListingError(
      'Per ora leggiamo solo i link di Vinted e eBay. Per il resto, fotografa l’oggetto.',
      'unsupported',
    );
  }

  return parsed.source === 'vinted'
    ? fetchVintedListing(parsed.url)
    : fetchEbayListing(parsed.url, parsed.id);
}

/** Oltre questa taglia non e' una foto di un annuncio, e non la scarichiamo. */
const MAX_IMAGE_BYTES = 8_000_000;
const TIPI_AMMESSI = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Le foto dell'annuncio, scaricate e pronte per l'identificazione.
 *
 * Le scarica il server e non il browser: sono su domini che non ci
 * autorizzano via CORS, e comunque il modello le vuole in base64 da qui.
 *
 * Una foto che non si scarica non ferma le altre. Ne bastano poche, e
 * un'analisi su tre foto invece che su cinque e' un'analisi peggiore che lo
 * dichiara da sola; un errore duro qui sarebbe invece un link che non
 * funziona senza spiegare perche'.
 */
export async function downloadListingImages(listing: SharedListing): Promise<ImageInput[]> {
  const scaricate = await Promise.all(
    listing.imageUrls.map(async (src): Promise<ImageInput | null> => {
      try {
        const response = await fetch(src, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return null;

        const tipo = (response.headers.get('content-type') ?? '').split(';')[0]!.trim();
        if (!TIPI_AMMESSI.includes(tipo as (typeof TIPI_AMMESSI)[number])) return null;

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null;

        return {
          mediaType: tipo as ImageInput['mediaType'],
          data: buffer.toString('base64'),
        };
      } catch {
        return null;
      }
    }),
  );

  const buone = scaricate.filter((image): image is ImageInput => image !== null);
  if (buone.length === 0) {
    throw new ListingError('Non siamo riusciti a scaricare le foto dell’annuncio.', 'no_photos');
  }
  return buone;
}
