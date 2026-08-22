import { AnthropicProvider } from './anthropic';
import { FixtureProvider, RecordingProvider } from './fixtures';
import type { ObjectIntelligenceProvider } from './provider';

let provider: ObjectIntelligenceProvider | null = null;

/**
 * In produzione si chiama sempre il modello. Le registrazioni servono a
 * sviluppare senza pagare, e servire un'analisi registrata come se fosse
 * fresca sarebbe la peggiore bugia che questo prodotto possa dire: qui il
 * numero e' il prodotto. Percio' il controllo e' un rifiuto secco, non un
 * avvertimento che si puo' ignorare.
 */
function buildProvider(): ObjectIntelligenceProvider {
  const production = process.env.NODE_ENV === 'production';
  const replay = process.env.STYMA_AI_FIXTURES === '1';
  const record = process.env.STYMA_AI_RECORD === '1';

  if (production && (replay || record)) {
    throw new Error(
      'STYMA_AI_FIXTURES e STYMA_AI_RECORD sono strumenti di sviluppo e non possono essere attivi in produzione.',
    );
  }

  if (replay) {
    console.info('[ai] registrazioni attive: nessuna chiamata al modello, nessun costo.');
    return new FixtureProvider();
  }
  if (record) {
    console.info('[ai] registrazione attiva: questa analisi si paga e viene salvata in bench/fixtures.');
    return new RecordingProvider(new AnthropicProvider());
  }
  return new AnthropicProvider();
}

/** Punto unico di scelta del provider: sostituirlo qui non tocca il resto. */
export function getProvider(): ObjectIntelligenceProvider {
  provider ??= buildProvider();
  return provider;
}

export { ProviderError } from './provider';
export type {
  IdentificationOutcome,
  ImageInput,
  MarketResearchOutcome,
  ObjectIntelligenceProvider,
  ResearchLaneEvent,
  ResearchOptions,
} from './provider';
