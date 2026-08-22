import Anthropic from '@anthropic-ai/sdk';
import { ProviderError } from '../provider';

let client: Anthropic | null = null;

/**
 * Inizializzazione pigra: creare il client a livello di modulo fa fallire
 * `next build`, che valuta le route senza variabili d'ambiente.
 */
export function getAnthropicClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ProviderError('ANTHROPIC_API_KEY non configurata', 'missing_credentials');
  }

  client = new Anthropic({ apiKey });
  return client;
}
