import type { Identification } from '@/schemas/identification';
import type { MarketResearch } from '@/schemas/market';
import type { UsageTotals } from './usage';

export type ImageInput = {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Contenuto in base64, senza prefisso data URL. */
  data: string;
};

export type IdentificationOutcome = {
  identification: Identification;
  usage: UsageTotals;
};

/** Esito di una singola corsia, appena si conclude. */
export type ResearchLaneEvent = {
  id: string;
  label: string;
  status: 'done' | 'failed';
  comparables: number;
};

export type ResearchOptions = {
  /**
   * Corsie da far partire. Assente significa tutte. Serve a comprare solo
   * cio' che serve: quando le inserzioni ci sono gia' ma mancano le vendite
   * concluse, si paga la corsia delle aste e non le altre due.
   */
  laneIds?: readonly string[];
  /**
   * Chiamata appena una corsia finisce. Serve a raccontare l'attesa mentre
   * accade: le corsie durano minuti, e un'interfaccia ferma sembra rotta.
   */
  onLaneSettled?: (event: ResearchLaneEvent) => void;
};

/**
 * La ricerca gira su piu' corsie parallele e puo' concludersi bene su alcune
 * e male su altre. In quel caso il risultato resta valido ma poggia su meno
 * dati: `warnings` esiste per dirlo, invece di lasciarlo intuire da una
 * confidenza piu' bassa del solito.
 */
export type MarketResearchOutcome = {
  research: MarketResearch;
  warnings: string[];
  /** Token e costo stimato di tutte le corsie messe insieme. */
  usage: UsageTotals;
};

/**
 * Interfaccia unica verso il modello. Il resto dell'applicazione non sa
 * quale provider stia rispondendo: si puo' sostituire senza toccare i servizi.
 */
export interface ObjectIntelligenceProvider {
  identify(images: ImageInput[]): Promise<IdentificationOutcome>;
  researchMarket(
    identification: Identification,
    options?: ResearchOptions,
  ): Promise<MarketResearchOutcome>;
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
