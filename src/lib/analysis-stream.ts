import type { AnalysisResult } from '@/schemas/analysis';
import type { ResearchLaneEvent } from '@/services/ai/provider';
import type { UsageTotals } from '@/services/ai/usage';

/**
 * Il protocollo fra `/api/valuate` e l'interfaccia. Sta qui e non nella route
 * perche' lo usano entrambi i lati: importare la route da un componente client
 * ne trascinerebbe l'SDK nel bundle.
 */
export type ValuateEvent =
  | { type: 'lanes'; lanes: { id: string; label: string }[] }
  | { type: 'lane'; lane: ResearchLaneEvent }
  | { type: 'cache'; ageDays: number; comparables: number }
  | { type: 'usage'; usage: UsageTotals }
  | { type: 'result'; result: AnalysisResult }
  | { type: 'error'; error: string; code: string };

/**
 * Legge un flusso SSE evento per evento. Le righe che non iniziano per `data:`
 * sono commenti di keep-alive e vanno ignorate senza rumore.
 */
export async function* readAnalysisEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ValuateEvent> {
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
            yield JSON.parse(line.slice(5).trim()) as ValuateEvent;
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
