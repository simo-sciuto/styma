import { NextResponse } from 'next/server';

import { errorResponse, providerErrorResponse } from '@/lib/api';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import {
  MAX_FILE_BYTES,
  MAX_IMAGES,
  MAX_TOTAL_BYTES,
  MIN_IMAGES,
  isAcceptedMimeType,
} from '@/lib/uploads';
import { getProvider, type ImageInput } from '@/services/ai';

export const runtime = 'nodejs';
/** L'identificazione con piu' foto puo' richiedere decine di secondi. */
export const maxDuration = 120;

export async function POST(request: Request) {
  const limit = await checkRateLimit(`identify:${clientKey(request)}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Troppe analisi ravvicinate. Attendi qualche secondo.', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('Richiesta non valida.', 'bad_request', 400);
  }

  const files = formData.getAll('images').filter((entry): entry is File => entry instanceof File);

  if (files.length < MIN_IMAGES) {
    return errorResponse('Serve almeno una foto per iniziare.', 'no_images', 400);
  }
  if (files.length > MAX_IMAGES) {
    return errorResponse(`Massimo ${MAX_IMAGES} foto per analisi.`, 'too_many_images', 400);
  }

  let totalBytes = 0;
  const images: ImageInput[] = [];

  for (const file of files) {
    if (!isAcceptedMimeType(file.type)) {
      return errorResponse(
        `Formato non supportato: ${file.type || 'sconosciuto'}. Usa JPEG, PNG o WebP.`,
        'unsupported_type',
        415,
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return errorResponse(`"${file.name}" supera il limite di 8 MB.`, 'file_too_large', 413);
    }

    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return errorResponse('Le foto insieme superano il limite consentito.', 'payload_too_large', 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    images.push({ mediaType: file.type, data: buffer.toString('base64') });
  }

  try {
    const { identification, usage } = await getProvider().identify(images);
    // Il costo si mostra solo in sviluppo: e' un dato sulla nostra infrastruttura.
    return NextResponse.json(
      process.env.NODE_ENV === 'production' ? { identification } : { identification, usage },
    );
  } catch (error) {
    return providerErrorResponse(error);
  }
}
