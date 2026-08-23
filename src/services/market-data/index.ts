import type { Identification } from '@/schemas/identification';
import type { MarketResearch } from '@/schemas/market';
import { searchEbay } from './ebay';
import { describeRelease, lookupRelease } from './discogs';

export type MarketDataOutcome = {
  research: MarketResearch;
  /** Da dichiarare a chi legge: dice su quali mercati poggia il risultato. */
  sources: string[];
};

/**
 * Quanti comparabili bastano perche' non valga la pena pagare anche la
 * ricerca col modello. Sotto questa soglia il campione e' troppo esile per
 * reggere da solo una forbice, e l'agente sul web guadagna il suo costo.
 */
export const ENOUGH_COMPARABLES = 5;

/**
 * Prezzi da fonti strutturate, senza passare dal modello.
 *
 * Una ricerca agentica sul web costava circa 300.000 token di input per
 * analisi. Qui la stessa informazione arriva gia' in forma di dati, a costo
 * di una chiamata HTTP: il modello resta a riconoscere l'oggetto, che e'
 * l'unica parte in cui e' insostituibile.
 *
 * Null quando nessuna fonte e' configurata o nessuna ha risposto.
 */
export async function collectMarketData(
  identification: Identification,
): Promise<MarketDataOutcome | null> {
  try {
    // Le due fonti non si sovrappongono: eBay porta inserzioni con un prezzo,
    // Discogs porta il catalogo e la situazione di mercato di un'edizione.
    const [ebay, release] = await Promise.all([
      searchEbay(identification),
      lookupRelease(identification),
    ]);
    // Zero inserzioni e' un esito, non un'assenza di esito: va detto a chi
    // aspetta, altrimenti sembra che non ci abbiamo nemmeno provato. Null solo
    // quando la fonte non e' configurata o non ha risposto.
    if (ebay === null && release === null) return null;

    const sources = [...(ebay?.marketplaces ?? [])];
    if (release) sources.push('Discogs');

    return {
      research: {
        comparables: ebay?.comparables ?? [],
        // Domanda e liquidita' non si deducono da un elenco di inserzioni:
        // servirebbero i venduti e i tempi di vendita, che questa API non da'.
        // "unknown" e' la risposta corretta, e il voto fra corsie la ignora.
        demand: 'unknown',
        liquidity: 'unknown',
        // Discogs misura la concorrenza, non la domanda: dedurre l'una
        // dall'altra sarebbe un'invenzione, e "unknown" resta la risposta
        // corretta finche' nessuno ha guardato i venduti.
        notes: release ? describeRelease(release) : [],
      },
      sources,
    };
  } catch (error) {
    // Una fonte che non risponde non deve far fallire l'analisi: si ricade
    // sulla ricerca col modello, che costa di piu' ma c'e'.
    console.warn('[market-data] fonti strutturate non disponibili', error);
    return null;
  }
}
