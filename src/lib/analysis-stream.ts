import type { AnalysisResult } from '@/schemas/analysis';
import type { Identification } from '@/schemas/identification';
import type { PartialIdentification } from '@/services/ai/partial';
import type { ResearchLaneEvent } from '@/services/ai/provider';
import type { UsageTotals } from '@/services/ai/usage';

/**
 * Il protocollo fra `/api/identify` e l'interfaccia.
 *
 * `partial` arriva mentre il modello sta ancora scrivendo: porta solo i campi
 * gia' chiusi in cima allo schema (nome, tipo, marca, modello), che sono
 * pronti dopo due o tre secondi dei ventuno che dura l'intera
 * identificazione. Non accorcia l'attesa: accorcia il tempo in cui chi guarda
 * non sa ancora niente.
 */
export type IdentifyEvent =
  | { type: 'partial'; partial: PartialIdentification }
  | { type: 'identification'; identification: Identification; usage?: UsageTotals }
  | { type: 'error'; error: string; code: string };

/**
 * Il protocollo fra `/api/valuate` e l'interfaccia. Sta qui e non nella route
 * perche' lo usano entrambi i lati: importare la route da un componente client
 * ne trascinerebbe l'SDK nel bundle.
 */
export type ValuateEvent =
  | { type: 'lanes'; lanes: { id: string; label: string }[] }
  | { type: 'lane'; lane: ResearchLaneEvent }
  | { type: 'cache'; ageDays: number; comparables: number }
  | { type: 'source'; label: string; comparables: number }
  | { type: 'usage'; usage: UsageTotals }
  | { type: 'result'; result: AnalysisResult }
  | { type: 'error'; error: string; code: string };

/**
 * Legge un flusso SSE evento per evento. Le righe che non iniziano per `data:`
 * sono commenti di keep-alive e vanno ignorate senza rumore.
 *
 * Generico perche' i flussi sono due, `/api/identify` e `/api/valuate`, e
 * leggere righe SSE e' la stessa identica cosa: scriverne due copie vorrebbe
 * dire avere due lettori che possono divergere. Il tipo dell'evento lo decide
 * chi chiama, e nessuno dei due lo valida qui: arriva dal nostro server, non
 * dal modello.
 */
export async function* readAnalysisEvents<T = ValuateEvent>(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      // L'ultimo pezzo puo' essere un evento a meta': resta in attesa del resto.
      buffer = chunks.pop() ?? '';

      for (const chunk of chunks) {
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          try {
            yield JSON.parse(line.slice(5).trim()) as T;
          } catch {
            // Un evento illeggibile non deve interrompere quelli che seguono.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
