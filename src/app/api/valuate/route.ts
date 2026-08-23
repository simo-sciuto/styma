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
import { calibrateAskingToSold } from '@/services/valuation/calibration';
import { readSaleObservations } from '@/services/inventory/calibration-repository';
import { getServerSupabase } from '@/lib/supabase/server';
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
      case 'fixture_missing':
        return { message: error.message, code: error.code };
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

  /**
   * Lo sconto sui prezzi richiesti, calibrato sulle vendite di chi sta usando
   * l'app se ne ha abbastanza. Va letto qui, fuori dallo stream, perche' ha
   * bisogno dei cookie della richiesta: dentro `start()` la sessione non c'e'
   * piu' e la RLS restituirebbe zero righe senza dirlo.
   */
  let askingToSoldRatio: number | undefined;
  try {
    const supabase = await getServerSupabase();
    if (supabase) {
      const calibration = calibrateAskingToSold(await readSaleObservations(supabase));
      if (calibration?.usable) askingToSoldRatio = calibration.observedRatio;
    }
  } catch (error) {
    // Senza calibrazione si usa l'assunzione: e' un miglioramento, non un
    // requisito, e non deve poter impedire un'analisi.
    console.warn('[valuate] calibrazione non disponibile', error);
  }

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

        /**
         * L'ordine e' per costo crescente, non per comodita'.
         *
         * 1. Fonti strutturate: gratis e istantanee. Vengono per prime proprio
         *    perche' non c'e' ragione di servire dati di tre settimane fa
         *    quando quelli di adesso non costano niente.
         * 2. Cache: evita di ripagare una ricerca col modello, che e' cara.
         * 3. Ricerca col modello: ~1,30 $ e qualche minuto. Ultima risorsa.
         */
        let structured: MarketResearch | null = null;
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

        // I comparabili descrivono il modello, e lo stato dell'esemplare lo
        // applica la valutazione: una ricerca recente vale quanto una nuova.
        // Quanto "recente" dipende da quanto in fretta si muove quel mercato.
        if (!market) {
          const cached = await readCachedResearch(identification);
          if (cached) {
            market = structured
              ? mergeMarketResearch([structured, cached.research])
              : cached.research;
            marketSource = {
              cached: true,
              researchedAt: cached.researchedAt,
              ageDays: cached.ageDays,
            };
            send({
              type: 'cache',
              ageDays: cached.ageDays,
              comparables: cached.research.comparables.length,
            });
          }
        }

        /**
         * Le inserzioni bastano per una forbice, ma senza nemmeno una vendita
         * conclusa la confidenza resta ferma su "low" e il prodotto non dira'
         * mai "compra". Su un oggetto di valore quella incertezza costa piu' di
         * quanto costi toglierla: si paga la sola corsia delle aste, che e'
         * l'unica fonte di aggiudicazioni ancora raggiungibile.
         */
        const preliminary = market ? valuate(identification, market, { askingToSoldRatio }) : null;
        const worthBuyingSoldData =
          preliminary !== null &&
          preliminary.available &&
          preliminary.soldCount === 0 &&
          preliminary.likely >= aiConfig.research.soldDataWorthItAboveEur;

        try {
          if (worthBuyingSoldData && market) {
            const lane = aiConfig.research.lanes.find((candidate) => candidate.id === 'auctions');
            if (lane) {
              send({ type: 'lanes', lanes: [{ id: lane.id, label: lane.label }] });
              try {
                const outcome = await getProvider().researchMarket(identification, {
                  laneIds: [lane.id],
                  onLaneSettled: (settled) => send({ type: 'lane', lane: settled }),
                });
                market = mergeMarketResearch([market, outcome.research]);
                if (process.env.NODE_ENV !== 'production') {
                  send({ type: 'usage', usage: outcome.usage });
                }
              } catch (error) {
                // Le inserzioni ce le abbiamo gia': un buco qui non deve
                // costare all'utente l'analisi che aveva gia' in mano.
                console.error('[valuate] corsia aste fallita', error);
              }
            }
          }

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

            // Si archivia solo cio' che e' costato: le inserzioni eBay sono
            // gratis e fresche, e conservarle vorrebbe dire servire domani un
            // annuncio scaduto al posto di uno vivo.
            void writeCachedResearch(identification, outcome.research);
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

        const valuation = valuate(identification, market, { askingToSoldRatio });
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
