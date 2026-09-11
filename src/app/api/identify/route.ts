import { NextResponse } from 'next/server';

import { describeProviderError, errorResponse } from '@/lib/api';
import type { IdentifyEvent } from '@/lib/analysis-stream';
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

  /*
   * La nota di chi ha l'oggetto in mano. Tagliata corta apposta: serve a dire
   * quello che una foto non mostra — un peso, un punzone letto sotto la base,
   * cosa ha detto il venditore — non a scrivere una scheda. Un campo lungo
   * inviterebbe a raccontare l'oggetto invece di aggiungere prove.
   */
  const notaGrezza = formData.get('note');
  const note =
    typeof notaGrezza === 'string' && notaGrezza.trim() !== ''
      ? notaGrezza.trim().slice(0, 400)
      : null;

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

  /*
   * Risposta a eventi, non JSON in blocco.
   *
   * L'identificazione dura ventuno secondi misurati su una foto sola, e sono
   * millecinquecento token di prosa generati uno dopo l'altro. Ma i campi che
   * servono a chi aspetta stanno in cima allo schema e sono pronti dopo due o
   * tre secondi. Mandarli avanti non accorcia l'attesa di un millisecondo:
   * accorcia il tempo in cui chi guarda non sa ancora niente, che e' l'unica
   * cosa che possiamo davvero cambiare qui.
   */
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: IdentifyEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false;
        }
      };

      try {
        const { identification, usage } = await getProvider().identify(images, {
          onPartial: (partial) => send({ type: 'partial', partial }),
          note,
        });
        // Il costo si mostra solo in sviluppo: e' un dato sulla nostra
        // infrastruttura.
        send({
          type: 'identification',
          identification,
          ...(process.env.NODE_ENV === 'production' ? {} : { usage }),
        });
      } catch (error) {
        const { message, code } = describeProviderError(error);
        send({ type: 'error', error: message, code });
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
