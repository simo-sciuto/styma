import type { Identification } from './identification';
import type { Comparable, MarketResearch } from './market';

export type ValuationConfidence = 'high' | 'medium' | 'low';

export type WeightedComparable = {
  comparable: Comparable;
  /** Prezzo letto sulla pagina, normalizzato in EUR. E' questo che entra nel calcolo, senza sconti. */
  priceEur: number;
  /** Peso complessivo 0-1 usato nel calcolo della fascia. */
  weight: number;
  /** Contributi al peso, per trasparenza. */
  weightBreakdown: {
    match: number;
    condition: number;
  };
};

/**
 * Su cosa poggiava la fascia: solo sullo stesso modello, o anche su oggetti
 * simili perche' di identici non ce n'erano abbastanza. Non e' un dettaglio
 * interno — cambia quanto fidarsi del numero, e va detto.
 */
export type ComparableTier = 'identical' | 'similar' | 'weak';

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
      /** Quanti dei comparabili usati sono lo stesso identico modello. */
      identicalCount: number;
      comparableTier: ComparableTier;
      /** Dispersione dei prezzi: alta = mercato volatile. */
      dispersion: number;
      reasons: string[];
    }
  | {
      available: false;
      reason: string;
      discarded: { comparable: Comparable; reason: string }[];
      /**
       * Cosa si e' comunque visto, quando non basta per una fascia.
       * Un rifiuto secco lascia chi e' davanti al banco esattamente dove
       * stava; due prezzi osservati, dichiarati come insufficienti, no.
       */
      observed: { count: number; lowEur: number; highEur: number } | null;
    };

export type Recommendation = 'BUY' | 'MAYBE' | 'PASS';

export type ScoreFactor = {
  label: string;
  direction: 'positive' | 'negative';
};

export type Economics = {
  expectedSalePrice: number;
  purchasePrice: number;
  expectedProfit: number;
  roi: number | null;
};

/**
 * Fin dove conviene pagare, e la sottrazione da cui esce.
 *
 * `breakdown` non e' un dettaglio diagnostico: e' la ragione per cui il
 * prezzo massimo si puo' mostrare. Un numero che nessuno puo' verificare e'
 * un numero da prendere per fede, e qui il numero *e'* il prodotto.
 */
export type PriceThresholds = {
  /** Fin dove e' un affare: coperti i costi e raggiunto il margine obiettivo. */
  buyUpTo: number | null;
  /** Fin dove i conti tornano senza guadagno vero: la fascia in cui trattare. */
  maybeUpTo: number | null;
  breakdown: {
    expectedSalePrice: number;
    riskBuffer: number;
    targetProfit: number;
  };
};

export type FlipAssessment = {
  /** Presente solo se l'utente ha indicato un prezzo di acquisto. */
  atPrice: {
    purchasePrice: number;
    score: number;
    recommendation: Recommendation;
    economics: Economics;
  } | null;
  thresholds: PriceThresholds;
  factors: ScoreFactor[];
};

/**
 * Da dove vengono i comparabili. Non e' un dettaglio tecnico: una ricerca di
 * tre settimane fa e' un'informazione che cambia la fiducia di chi decide,
 * e va detta invece di essere nascosta dietro un numero che sembra fresco.
 */
export type MarketSource = {
  cached: boolean;
  researchedAt: string;
  ageDays: number;
};

export type AnalysisResult = {
  identification: Identification;
  market: MarketResearch | null;
  /** Null quando la ricerca non e' andata a buon fine. */
  marketSource: MarketSource | null;
  valuation: Valuation;
  flip: FlipAssessment | null;
  /** Avvisi da mostrare all'utente (dati scarsi, foto insufficienti, ...). */
  warnings: string[];
};
