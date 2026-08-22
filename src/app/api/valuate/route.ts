import { NextResponse } from 'next/server';
import * as z from 'zod/v4';

import { errorResponse, providerErrorResponse } from '@/lib/api';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import { IdentificationSchema } from '@/schemas/identification';
import type { AnalysisResult } from '@/schemas/analysis';
import type { MarketResearch } from '@/schemas/market';
import { getProvider, ProviderError } from '@/services/ai';
import { assessFlip, valuate } from '@/services/valuation';

export const runtime = 'nodejs';
/** La ricerca di mercato fa piu' giri di web search: serve margine. */
export const maxDuration = 300;

const RequestSchema = z.object({
  identification: IdentificationSchema,
  purchasePrice: z.number().nonnegative().nullable().optional(),
});

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
  const warnings: string[] = [];

  let market: MarketResearch | null = null;
  try {
    market = await getProvider().researchMarket(identification);
  } catch (error) {
    // Senza dati di mercato l'analisi resta utile: mostriamo l'identificazione
    // e diciamo chiaramente che il valore non e' stimabile.
    if (error instanceof ProviderError && error.code === 'missing_credentials') {
      return providerErrorResponse(error);
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

  const result: AnalysisResult = { identification, market, valuation, flip, warnings };
  return NextResponse.json(result);
}
