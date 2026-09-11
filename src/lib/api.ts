import { NextResponse } from 'next/server';
import { ProviderError } from '@/services/ai';

export type ApiError = { error: string; code: string };

export function errorResponse(message: string, code: string, status: number) {
  return NextResponse.json<ApiError>({ error: message, code }, { status });
}

/**
 * Da un errore del provider al messaggio che legge chi sta davanti al banco.
 *
 * Sta qui e non dentro `providerErrorResponse` perche' lo usano due strade
 * diverse: una risposta HTTP e un evento dentro un flusso SSE. Se le due
 * traducessero per conto loro, lo stesso guasto direbbe due cose diverse a
 * seconda di quale rotta lo incontra.
 */
export function describeProviderError(error: unknown): { message: string; code: string; status: number } {
  if (error instanceof ProviderError) {
    // Ogni errore lascia una traccia: un 503 senza una riga di log manda a
    // indovinare, e indovinare su questo progetto e' gia' costato abbastanza.
    console.error(`[api] ${error.code}: ${error.message}`);

    switch (error.code) {
      // Questi due messaggi dicono gia' esattamente dove si risolve il
      // problema: sostituirli con una frase generica toglierebbe l'unica
      // informazione utile.
      case 'budget_exhausted':
      case 'fixture_missing':
        return { message: error.message, code: error.code, status: 503 };
      case 'missing_credentials':
        return {
          message: 'Il servizio di analisi non e’ configurato. Manca la chiave API.',
          code: error.code,
          status: 503,
        };
      case 'rate_limited':
        return { message: 'Troppe analisi in corso. Riprova fra poco.', code: error.code, status: 429 };
      case 'unavailable':
        return {
          message: 'Il servizio di analisi non risponde. Riprova fra poco.',
          code: error.code,
          status: 503,
        };
      case 'invalid_response':
        return {
          message: 'L’analisi non ha prodotto un risultato utilizzabile.',
          code: error.code,
          status: 502,
        };
      default:
        break;
    }
  }

  console.error('[api] errore non gestito', error);
  return { message: 'Qualcosa e’ andato storto durante l’analisi.', code: 'unknown', status: 500 };
}

/** Traduce gli errori del provider in risposte HTTP con messaggi leggibili. */
export function providerErrorResponse(error: unknown) {
  const { message, code, status } = describeProviderError(error);
  return errorResponse(message, code, status);
}
