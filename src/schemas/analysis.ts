import type { Identification } from './identification';
import type { Comparable, MarketResearch } from './market';

export type ValuationConfidence = 'high' | 'medium' | 'low';

export type WeightedComparable = {
  comparable: Comparable;
  /** Prezzo normalizzato in EUR. */
  priceEur: number;
  /** Peso complessivo 0-1 usato nel calcolo della forbice. */
  weight: number;
  /** Contributi al peso, per trasparenza. */
  weightBreakdown: {
    match: number;
    kind: number;
    recency: number;
    condition: number;
  };
};

export type Valuation =
  | {
      available: true;
      currency: 'EUR';
      low: number;
      likely: number;
      high: number;
      confidence: ValuationConfidence;
      confidenceScore: number;
      /** Comparabili effettivamente usati, ordinati per peso. */
      used: WeightedComparable[];
      /** Comparabili scartati e il motivo. */
      discarded: { comparable: Comparable; reason: string }[];
      strongCount: number;
      soldCount: number;
      /** Dispersione dei prezzi: alta = mercato volatile. */
      dispersion: number;
      reasons: string[];
    }
  | {
      available: false;
      reason: string;
      discarded: { comparable: Comparable; reason: string }[];
    };

export type Recommendation = 'BUY' | 'MAYBE' | 'PASS';

export type ScoreFactor = {
  label: string;
  direction: 'positive' | 'negative';
};

export type Economics = {
  expectedSalePrice: number;
  purchasePrice: number;
  marketplaceFees: number;
  shipping: number;
  expectedProfit: number;
  roi: number | null;
};

export type FlipAssessment = {
  /** Presente solo se l'utente ha indicato un prezzo di acquisto. */
  atPrice: {
    purchasePrice: number;
    score: number;
    recommendation: Recommendation;
    economics: Economics;
  } | null;
  /** Prezzo massimo di acquisto per restare in BUY / MAYBE. */
  thresholds: {
    buyUpTo: number | null;
    maybeUpTo: number | null;
  };
  factors: ScoreFactor[];
};

export type AnalysisResult = {
  identification: Identification;
  market: MarketResearch | null;
  valuation: Valuation;
  flip: FlipAssessment | null;
  /** Avvisi da mostrare all'utente (dati scarsi, foto insufficienti, ...). */
  warnings: string[];
};
