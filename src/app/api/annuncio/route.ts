import { describeProviderError, errorResponse } from '@/lib/api';
import type { ListingEvent } from '@/lib/analysis-stream';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import type { Identification } from '@/schemas/identification';
import { getProvider } from '@/services/ai';
import {
  ListingError,
  downloadListingImages,
  fetchListing,
  sellerQuery,
  type SharedListing,
} from '@/services/listings';

export const runtime = 'nodejs';
/** Leggere la pagina piu' identificare: la seconda parte e' la piu' lenta. */
export const maxDuration = 120;

/**
 * Il titolo dell'annuncio entra come *query*, mai come affermazione.
 *
 * Su Vinted il nome del modello e' il valore: «The North Face» da sola cerca
 * seicento borse diverse, «Base Camp High Pile Mini» cerca quella. Ma quel
 * nome lo dice chi vende, e noi non l'abbiamo letto da nessuna parte — metterlo
 * in `model` vorrebbe dire far affermare al prodotto una cosa che non ha
 * verificato, che e' il divieto piu' vecchio di questo codice.
 *
 * Una query invece non afferma niente: dice «prova a cercare anche cosi'», e
 * saranno i comparabili trovati a reggere o a non reggere. Sta davanti quando
 * un modello non l'abbiamo letto, perche' li' le parole del venditore sono
 * l'unica stringa di ricerca precisa che esista; dietro quando ce l'abbiamo,
 * perche' li' la nostra e' migliore. La pagina dichiara che l'abbiamo usata.
 */
function conLeParoleDelVenditore(
  identification: Identification,
  listing: SharedListing,
): Identification {
  // Non il titolo intero: misurato, da' zero risultati su cinque mercati.
  // `sellerQuery` lo taglia dalla marca in poi, dove sta il nome del prodotto.
  const query = sellerQuery(listing.title, listing.brand ?? identification.brand);
  if (!query) return identification;

  const gia = identification.searchQueries.some(
    (esistente) => esistente.trim().toLowerCase() === query.toLowerCase(),
  );
  if (gia) return identification;

  return {
    ...identification,
    searchQueries:
      identification.model === null
        ? [query, ...identification.searchQueries]
        : [...identification.searchQueries, query],
  };
}

/**
 * Da un link a un verdetto.
 *
 * L'idea viene da come si usa il telefono davvero: stai scorrendo Vinted, vedi
 * una cosa che forse conviene, e per saperlo dovresti uscire dall'app e
 * cercare a mano. Il link ce l'hai gia': e' l'unica cosa che quel momento ti
 * da' gratis.
 *
 * Da qui in poi non cambia niente. Le foto dell'annuncio entrano nella stessa
 * identificazione delle foto scattate da te, e il risultato passa dalla stessa
 * `/api/valuate`. Il testo dell'annuncio **non** entra nel prompt: se il
 * venditore scrive «Olivetti Valentine» e le foto mostrano una Lettera 32,
 * quel disaccordo e' l'informazione piu' utile della pagina, e sparirebbe se
 * il modello leggesse il titolo prima di guardare.
 */
export async function POST(request: Request) {
  const limit = await checkRateLimit(`annuncio:${clientKey(request)}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return errorResponse('Troppe analisi ravvicinate. Attendi qualche secondo.', 'rate_limited', 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Richiesta non valida.', 'bad_request', 400);
  }

  const url = (body as { url?: unknown } | null)?.url;
  if (typeof url !== 'string' || url.trim() === '' || url.length > 2048) {
    return errorResponse('Serve il link di un annuncio.', 'bad_request', 400);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: ListingEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false;
        }
      };

      try {
        // Primo: cosa dice l'annuncio. Arriva in meno di un secondo, molto
        // prima dell'identificazione, ed e' gia' abbastanza per far vedere a
        // chi aspetta che abbiamo aperto la pagina giusta.
        const listing = await fetchListing(url);
        send({ type: 'listing', listing });

        const images = await downloadListingImages(listing);
        send({ type: 'photos', count: images.length });

        const { identification, usage } = await getProvider().identify(images, {
          onPartial: (partial) => send({ type: 'partial', partial }),
        });

        send({
          type: 'identification',
          identification: conLeParoleDelVenditore(identification, listing),
          ...(process.env.NODE_ENV === 'production' ? {} : { usage }),
        });
      } catch (error) {
        if (error instanceof ListingError) {
          console.error(`[annuncio] ${error.code}: ${error.message}`);
          send({ type: 'error', error: error.message, code: error.code });
        } else {
          const { message, code } = describeProviderError(error);
          send({ type: 'error', error: message, code });
        }
      } finally {
        open = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
