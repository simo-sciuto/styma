import { NextResponse } from 'next/server';
import * as z from 'zod/v4';

import { errorResponse } from '@/lib/api';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import { IdentificationSchema } from '@/schemas/identification';
import type { MarketResearch } from '@/schemas/market';
import type { MarketSource } from '@/schemas/analysis';
import type { ValuateEvent } from '@/lib/analysis-stream';
import { aiConfig } from '@/services/ai/config';
import { getProvider, ProviderError } from '@/services/ai';
import { assessFlip, valuate } from '@/services/valuation';
import { readCachedResearch, writeCachedResearch } from '@/services/market-cache';
import { ENOUGH_COMPARABLES, collectMarketData } from '@/services/market-data';
import { mergeMarketResearch } from '@/services/ai/merge';

export const runtime = 'nodejs';
/** Le corsie di ricerca girano in parallelo, ma ognuna fa piu' giri: serve margine. */
export const maxDuration = 300;

const RequestSchema = z.object({
  identification: IdentificationSchema,
  purchasePrice: z.number().nonnegative().nullable().optional(),
});

/** Ogni 15 secondi, per tenere aperta la connessione dietro i proxy. */
const HEARTBEAT_MS = 15_000;

function messageForProviderError(error: unknown): { message: string; code: string } {
  if (error instanceof ProviderError) {
    switch (error.code) {
      case 'missing_credentials':
        return { message: 'Il servizio di analisi non e’ configurato. Manca la chiave API.', code: error.code };
      case 'rate_limited':
        return { message: 'Troppe analisi in corso. Riprova fra poco.', code: error.code };
      case 'unavailable':
        return { message: 'Il servizio di analisi non risponde. Riprova fra poco.', code: error.code };
      case 'invalid_response':
        return { message: 'L’analisi non ha prodotto un risultato utilizzabile.', code: error.code };
      default:
        break;
    }
  }
  return { message: 'Qualcosa e’ andato storto durante l’analisi.', code: 'unknown' };
}

/**
 * Risposta in streaming: la ricerca dura minuti e le corsie finiscono in
 * momenti diversi. Dirlo mentre accade e' l'unico modo perche' l'attesa
 * davanti a un banco non sembri un blocco.
 *
 * Gli errori di validazione restano JSON con lo stato giusto: si sa gia'
 * prima di iniziare. Quelli che emergono durante l'analisi arrivano come
 * evento `error`, perche' a quel punto la risposta e' gia' un 200 aperto.
 */
export async function POST(request: Request) {
  const limit = checkRateLimit(`valuate:${clientKey(request)}`, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Troppe analisi ravvicinate. Attendi qualche secondo.', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Richiesta non valida.', 'bad_request', 400);
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('Dati di identificazione non validi.', 'bad_request', 400);
  }

  const { identification, purchasePrice = null } = parsed.data;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false;
        }
      };
      const send = (event: ValuateEvent) => write(`data: ${JSON.stringify(event)}\n\n`);
      const heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);

      try {
        const warnings: string[] = [];
        let market: MarketResearch | null = null;
        let marketSource: MarketSource | null = null;

        // Una ricerca gia' fatta di recente sullo stesso modello vale quanto una
        // nuova: i comparabili descrivono il modello, e lo stato dell'esemplare
        // lo applica la valutazione. Quanto "di recente" dipende dal mercato.
        const cached = await readCachedResearch(identification);
        if (cached) {
          market = cached.research;
          marketSource = { cached: true, researchedAt: cached.researchedAt, ageDays: cached.ageDays };
          send({ type: 'cache', ageDays: cached.ageDays, comparables: cached.research.comparables.length });
        }

        // Prima le fonti strutturate: gli stessi prezzi, senza far navigare il
        // modello. Se bastano, la ricerca agentica non parte proprio.
        let structured: MarketResearch | null = null;
        if (!market) {
          const data = await collectMarketData(identification);
          if (data) {
            structured = data.research.comparables.length > 0 ? data.research : null;
            send({
              type: 'source',
              label: `eBay (${data.sources.join(', ')})`,
              comparables: data.research.comparables.length,
            });
            if (data.research.comparables.length >= ENOUGH_COMPARABLES) {
              market = data.research;
              marketSource = { cached: false, researchedAt: new Date().toISOString(), ageDays: 0 };
            }
          }
        }

        try {
          if (!market) {
            // Annunciate solo ora: se la cache o le fonti strutturate hanno
            // risposto, queste corsie non partono, e dichiararle comunque
            // sarebbe raccontare un lavoro che non stiamo facendo.
            send({
              type: 'lanes',
              lanes: aiConfig.research.lanes.map(({ id, label }) => ({ id, label })),
            });

            const outcome = await getProvider().researchMarket(identification, {
              onLaneSettled: (lane) => send({ type: 'lane', lane }),
            });
            // Quello che eBay aveva gia' trovato non si butta: la fusione
            // deduplica per URL, quindi sommarlo non gonfia il campione.
            market = structured
              ? mergeMarketResearch([structured, outcome.research])
              : outcome.research;
            marketSource = { cached: false, researchedAt: new Date().toISOString(), ageDays: 0 };
            warnings.push(...outcome.warnings);
            // Il costo si mostra solo in sviluppo: e' un dato sulla nostra infrastruttura.
            if (process.env.NODE_ENV !== 'production') send({ type: 'usage', usage: outcome.usage });

            // Non blocca la risposta: se l'archiviazione fallisce, l'utente ha
            // comunque la sua analisi.
            void writeCachedResearch(identification, market);
          }
        } catch (error) {
          // Senza chiave non c'e' analisi possibile: e' l'unico caso in cui
          // vale la pena fermarsi invece di mostrare la sola identificazione.
          if (error instanceof ProviderError && error.code === 'missing_credentials') {
            const { message, code } = messageForProviderError(error);
            send({ type: 'error', error: message, code });
            return;
          }
          console.error('[valuate] ricerca di mercato fallita', error);
          warnings.push('La ricerca di mercato non e’ andata a buon fine: nessuna stima disponibile.');
        }

        const valuation = valuate(identification, market);
        const flip = assessFlip(identification, market, valuation, purchasePrice);

        if (identification.confidence < 0.5) {
          warnings.push('L’identificazione e’ incerta: la stima che segue va presa con cautela.');
        }
        if (identification.imageQuality === 'poor') {
          warnings.push('Le foto ricevute sono di qualita’ bassa: piu’ scatti migliorerebbero il risultato.');
        }
        if (valuation.available && valuation.soldCount === 0) {
          warnings.push('Nessuna vendita conclusa fra i comparabili: i prezzi richiesti sono spesso ottimistici.');
        }

        send({
          type: 'result',
          result: { identification, market, marketSource, valuation, flip, warnings },
        });
      } catch (error) {
        console.error('[valuate] errore non gestito', error);
        const { message, code } = messageForProviderError(error);
        send({ type: 'error', error: message, code });
      } finally {
        clearInterval(heartbeat);
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      /** Disattiva il buffering di nginx, che altrimenti annullerebbe lo streaming. */
      'X-Accel-Buffering': 'no',
    },
  });
}
