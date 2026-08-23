import { NextResponse } from 'next/server';
import { ProviderError } from '@/services/ai';

export type ApiError = { error: string; code: string };

export function errorResponse(message: string, code: string, status: number) {
  return NextResponse.json<ApiError>({ error: message, code }, { status });
}

/** Traduce gli errori del provider in risposte HTTP con messaggi leggibili. */
export function providerErrorResponse(error: unknown) {
  if (error instanceof ProviderError) {
    // Ogni errore lascia una traccia: un 503 senza una riga di log manda a
    // indovinare, e indovinare su questo progetto e' gia' costato abbastanza.
    console.error(`[api] ${error.code}: ${error.message}`);

    switch (error.code) {
      case 'budget_exhausted':
        // Il messaggio dice gia' dove si risolve: sostituirlo con una frase
        // generica costringerebbe a leggere i log del server per scoprirlo.
        return errorResponse(error.message, error.code, 503);
      case 'fixture_missing':
        // Il messaggio del provider dice esattamente cosa fare, e questo caso
        // esiste solo in sviluppo: sostituirlo con una frase generica
        // toglierebbe l'unica informazione utile.
        return errorResponse(error.message, error.code, 503);
      case 'missing_credentials':
        return errorResponse(
          'Il servizio di analisi non e’ configurato. Manca la chiave API.',
          error.code,
          503,
        );
      case 'rate_limited':
        return errorResponse('Troppe analisi in corso. Riprova fra poco.', error.code, 429);
      case 'unavailable':
        return errorResponse('Il servizio di analisi non risponde. Riprova fra poco.', error.code, 503);
      case 'invalid_response':
        return errorResponse('L’analisi non ha prodotto un risultato utilizzabile.', error.code, 502);
      default:
        break;
    }
  }

  console.error('[api] errore non gestito', error);
  return errorResponse('Qualcosa e’ andato storto durante l’analisi.', 'unknown', 500);
}
