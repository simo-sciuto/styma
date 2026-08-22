import { AnthropicProvider } from './anthropic';
import type { ObjectIntelligenceProvider } from './provider';

let provider: ObjectIntelligenceProvider | null = null;

/** Punto unico di scelta del provider: sostituirlo qui non tocca il resto. */
export function getProvider(): ObjectIntelligenceProvider {
  provider ??= new AnthropicProvider();
  return provider;
}

export { ProviderError } from './provider';
export type {
  ImageInput,
  MarketResearchOutcome,
  ObjectIntelligenceProvider,
  ResearchLaneEvent,
  ResearchOptions,
} from './provider';
