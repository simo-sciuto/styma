import type { Identification } from '@/schemas/identification';
import type { MarketResearch } from '@/schemas/market';

export type ImageInput = {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Contenuto in base64, senza prefisso data URL. */
  data: string;
};

/**
 * Interfaccia unica verso il modello. Il resto dell'applicazione non sa
 * quale provider stia rispondendo: si puo' sostituire senza toccare i servizi.
 */
export interface ObjectIntelligenceProvider {
  identify(images: ImageInput[]): Promise<Identification>;
  researchMarket(identification: Identification): Promise<MarketResearch>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'missing_credentials'
      | 'rate_limited'
      | 'invalid_response'
      | 'unavailable'
      | 'unknown',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ProviderError';
  }
}
