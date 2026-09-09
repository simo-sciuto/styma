import { NextResponse } from 'next/server';
import * as z from 'zod/v4';

import { errorResponse, providerErrorResponse } from '@/lib/api';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import { getItemDetail } from '@/services/inventory/repository';
import { suggestPrice } from '@/services/listing/price';
import { getProvider } from '@/services/ai';
import type { ListingFacts } from '@/services/ai/provider';

export const runtime = 'nodejs';
export const maxDuration = 60;

const RequestSchema = z.object({ itemId: z.string().uuid() });

/**
 * Genera il testo di un annuncio per un oggetto gia' salvato. Chiama il
 * modello solo per il testo: il prezzo suggerito viene dalla valutazione
 * gia' calcolata, non da qui.
 */
export async function POST(request: Request) {
  const limit = await checkRateLimit(`listing:${clientKey(request)}`, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Troppe richieste ravvicinate. Attendi qualche secondo.', code: 'rate_limited' },
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
    return errorResponse('Richiesta non valida.', 'bad_request', 400);
  }

  // La RLS decide se l'oggetto e' di chi chiede: 'not_found' copre sia
  // "non esiste" sia "non e' tuo", apposta indistinguibili da fuori.
  const result = await getItemDetail(parsed.data.itemId);
  if (result.status === 'not_found') {
    return errorResponse('Oggetto non trovato.', 'not_found', 404);
  }
  if (result.status === 'not_configured') {
    return errorResponse('L’inventario non e’ configurato.', 'not_configured', 503);
  }
  if (result.status === 'unreachable') {
    return errorResponse('Non riusciamo a raggiungere l’inventario in questo momento.', 'unreachable', 503);
  }

  const { item, valuation } = result.detail;

  const facts: ListingFacts = {
    name: item.title,
    category: item.category,
    brand: item.brand,
    model: item.model,
    period: item.estimated_period,
    condition: item.condition,
    materials: item.materials,
    characteristics: item.characteristics,
    conditionNotes: item.condition_notes,
    markings: item.markings,
    history: item.description,
  };

  try {
    const outcome = await getProvider().generateListing(facts);
    return NextResponse.json({
      listing: outcome.listing,
      price: suggestPrice(valuation),
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
