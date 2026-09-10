import type { Identification } from '@/schemas/identification';
import type { MarketResearch } from '@/schemas/market';
import type {
  Economics,
  FlipAssessment,
  PriceThresholds,
  Recommendation,
  ScoreFactor,
  Valuation,
} from '@/schemas/analysis';
import { flipConfig } from './config';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * I conti a un prezzo di acquisto e a un prezzo di vendita. Esportata perche'
 * l'interfaccia mostra gli stessi numeri anche agli estremi della fascia —
 * quanto resta se vendi al minimo, quanto se vendi al massimo — e riscrivere
 * la formula la' significherebbe avere due aritmetiche che possono divergere.
 */
export function economicsAt(purchasePrice: number, expectedSalePrice: number): Economics {
  const marketplaceFees = expectedSalePrice * flipConfig.marketplaceFeeRate;
  const expectedProfit = expectedSalePrice - purchasePrice - marketplaceFees;
  const totalCost = purchasePrice + marketplaceFees;

  return {
    expectedSalePrice,
    purchasePrice,
    marketplaceFees: Math.round(marketplaceFees * 100) / 100,
    expectedProfit: Math.round(expectedProfit * 100) / 100,
    roi: totalCost > 0 ? expectedProfit / totalCost : null,
  };
}

/**
 * Se domanda e liquidita' sono state osservate davvero.
 *
 * Con la ricerca agentica spenta la risposta e' sempre no: eBay restituisce
 * inserzioni e prezzi, non domanda. Il campo esiste ma vale "unknown".
 */
function marketObserved(research: MarketResearch | null): boolean {
  if (research === null) return false;
  return research.demand !== 'unknown' || research.liquidity !== 'unknown';
}

/**
 * I pesi effettivi del punteggio.
 *
 * Quando il mercato non e' stato osservato, il peso della liquidita' non
 * diventa mezzo punto regalato a tutti: si ridistribuisce fra profitto e
 * confidenza nella stessa proporzione che avevano gia'. Il punteggio torna
 * cosi' a usare tutto l'intervallo 0-100 invece di schiacciarsi fra 12 e 87.
 */
export function effectiveWeights(research: MarketResearch | null): {
  profit: number;
  confidence: number;
  liquidity: number;
} {
  const { profit, confidence, liquidity } = flipConfig.scoreWeights;
  if (marketObserved(research)) return { profit, confidence, liquidity };

  const remaining = profit + confidence;
  return {
    profit: profit + (liquidity * profit) / remaining,
    confidence: confidence + (liquidity * confidence) / remaining,
    liquidity: 0,
  };
}

function marketScore(research: MarketResearch | null): number {
  const demand = flipConfig.demandScores[research?.demand ?? 'unknown'];
  const liquidity = flipConfig.liquidityScores[research?.liquidity ?? 'unknown'];
  return 0.5 * demand + 0.5 * liquidity;
}

function penaltyPoints(valuation: Extract<Valuation, { available: true }>, identification: Identification) {
  let points = flipConfig.penalties.maxVolatility * clamp01(valuation.dispersion);
  if (identification.condition === 'poor') points += flipConfig.penalties.poorCondition;
  else if (identification.condition === 'fair') points += flipConfig.penalties.fairCondition;
  return points;
}

/**
 * Quanto del valore atteso si tiene indietro perche' la stima potrebbe
 * sbagliare. E' l'unica riga della sottrazione che dipende da quanto siamo
 * sicuri: una stima fragile non alza il rischio di chi compra, gli abbassa il
 * prezzo massimo.
 */
export function riskBufferRate(
  valuation: Extract<Valuation, { available: true }>,
  identification: Identification,
): number {
  const { riskBuffer } = flipConfig;

  let rate = riskBuffer.base;
  rate += riskBuffer.byConfidence[valuation.confidence];
  rate += riskBuffer.maxDispersion * clamp01(valuation.dispersion);
  if (identification.condition === 'poor') rate += riskBuffer.byCondition.poor;
  else if (identification.condition === 'fair') rate += riskBuffer.byCondition.fair;

  return Math.min(rate, riskBuffer.cap);
}

/**
 * Il prezzo massimo di acquisto, leggibile riga per riga.
 *
 *   valore atteso di vendita
 *   − commissioni
 *   − cuscinetto di rischio
 *   = quanto ti resta in mano
 *
 * Dentro quella cifra ci stanno due cose: il prezzo che paghi e il tuo
 * guadagno. Fin dove arriva da sola e' la soglia della trattativa — i conti
 * tornano, non ci guadagni. Divisa fra le due, e' la soglia dell'affare.
 *
 * Prima nasceva cercando per bisezione il prezzo a cui il punteggio toccava
 * settanta. Era coerente ma non si poteva mostrare: nessuno puo' verificare
 * una bisezione su un punteggio composito, e un prezzo massimo che non si
 * puo' controllare e' un numero da prendere per fede.
 */
export function priceThresholds(
  valuation: Extract<Valuation, { available: true }>,
  identification: Identification,
): PriceThresholds {
  const expectedSalePrice = valuation.likely;
  const fees = expectedSalePrice * flipConfig.marketplaceFeeRate;
  const riskBuffer = expectedSalePrice * riskBufferRate(valuation, identification);

  /** Quanto resta in mano dopo la vendita: dentro ci stanno il prezzo che paghi e il tuo guadagno. */
  const coversCosts = expectedSalePrice - fees - riskBuffer;

  /*
   * Il guadagno si misura su quello che spendi, non sul prezzo di vendita.
   *
   * Prima era una quota del venduto (25%) e sembrava equivalente. Non lo era:
   * i costi fissi si tolgono prima, quindi la stessa configurazione pretendeva
   * il 163% di ritorno su un oggetto da 45 € e il 95% su uno da 550. Su una
   * fascia 30-70 € l'affare partiva sotto i 12 €, e chi leggeva vedeva due
   * numeri che sembravano darsi torto a vicenda.
   *
   * Diviso invece che sottratto, la richiesta e' la stessa a ogni livello di
   * prezzo: quello che resta deve coprire quanto paghi piu' il tuo guadagno.
   */
  const buyUpTo = coversCosts / (1 + flipConfig.dealRoi);

  // Sotto l'euro non e' un prezzo: e' un modo elegante di dire di no.
  const round2 = (value: number) => Math.round(value * 100) / 100;
  const soglia = buyUpTo >= 1 ? Math.floor(buyUpTo) : null;

  return {
    buyUpTo: soglia,
    maybeUpTo: coversCosts >= 1 ? Math.floor(coversCosts) : null,
    breakdown: {
      expectedSalePrice: round2(expectedSalePrice),
      fees: round2(fees),
      riskBuffer: round2(riskBuffer),
      // Quanto ti resta davvero pagando la soglia. Le righe continuano a
      // tornare a mente: venduto, meno commissioni, meno cuscinetto, meno
      // guadagno, uguale prezzo massimo.
      targetProfit: soglia === null ? round2(coversCosts) : round2(coversCosts - soglia),
    },
  };
}

/**
 * Il verdetto e' la fascia in cui cade il prezzo richiesto, non una seconda
 * lettura del punteggio. Sono due domande diverse — «quanto dovrei pagarlo»
 * e «quanto e' buona questa occasione» — e finche' il verdetto usciva dal
 * punteggio potevano contraddirsi in faccia all'utente: COMPRALO scritto
 * sopra un prezzo piu' alto del massimo consigliato due righe sotto.
 */
export function recommendationAt(price: number, thresholds: PriceThresholds): Recommendation {
  if (thresholds.buyUpTo !== null && price <= thresholds.buyUpTo) return 'BUY';
  if (thresholds.maybeUpTo !== null && price <= thresholds.maybeUpTo) return 'MAYBE';
  return 'PASS';
}

/**
 * Il punteggio non misura il valore dell'oggetto ma quanto conviene comprarlo
 * a un certo prezzo. Il prezzo di acquisto e' quindi un ingresso, non un dettaglio.
 */
export function assessFlip(
  identification: Identification,
  research: MarketResearch | null,
  valuation: Valuation,
  purchasePrice: number | null,
): FlipAssessment | null {
  if (!valuation.available) return null;

  const expectedSalePrice = valuation.likely;
  const confidenceScore = valuation.confidenceScore;
  const liquidityScore = marketScore(research);
  const penalties = penaltyPoints(valuation, identification);
  const weights = effectiveWeights(research);
  const thresholds = priceThresholds(valuation, identification);

  const scoreAt = (price: number): { score: number; economics: Economics } => {
    const economics = economicsAt(price, expectedSalePrice);

    let profitScore = 0;
    if (economics.expectedProfit > 0) {
      const roiComponent = economics.roi === null ? 1 : clamp01(economics.roi / flipConfig.targetRoi);
      const absoluteComponent = clamp01(economics.expectedProfit / flipConfig.targetProfitEur);
      profitScore = 0.6 * roiComponent + 0.4 * absoluteComponent;
    }

    const raw =
      100 *
        (weights.profit * profitScore +
          weights.confidence * confidenceScore +
          weights.liquidity * liquidityScore) -
      penalties;

    return { score: Math.round(Math.min(100, Math.max(0, raw))), economics };
  };

  const factors: ScoreFactor[] = [];
  if (valuation.strongCount > 0) {
    factors.push({
      label: `${valuation.strongCount} comparabili molto vicini all’oggetto`,
      direction: 'positive',
    });
  }
  if (valuation.comparableTier === 'identical') {
    factors.push({
      label: `${valuation.identicalCount} annunci dello stesso modello`,
      direction: 'positive',
    });
  } else if (valuation.comparableTier === 'similar') {
    factors.push({ label: 'Nessun annuncio dello stesso identico modello', direction: 'negative' });
  } else {
    factors.push({ label: 'Nessun comparabile davvero vicino', direction: 'negative' });
  }
  if (identification.brand) {
    factors.push({ label: `Marca riconoscibile: ${identification.brand}`, direction: 'positive' });
  }
  if (research?.demand === 'high') factors.push({ label: 'Domanda alta', direction: 'positive' });
  if (research?.demand === 'low') factors.push({ label: 'Domanda bassa', direction: 'negative' });
  if (research?.liquidity === 'fast') factors.push({ label: 'Si vende in fretta', direction: 'positive' });
  if (research?.liquidity === 'slow') factors.push({ label: 'Rivendita lenta', direction: 'negative' });
  if (valuation.dispersion > 0.6) {
    factors.push({ label: 'Prezzi di mercato molto variabili', direction: 'negative' });
  }
  if (identification.condition === 'poor' || identification.condition === 'fair') {
    factors.push({ label: 'Stato di conservazione problematico', direction: 'negative' });
  }
  if (valuation.confidence === 'low') {
    factors.push({ label: 'Stima poco affidabile', direction: 'negative' });
  }
  const atPrice =
    purchasePrice !== null && Number.isFinite(purchasePrice) && purchasePrice >= 0
      ? (() => {
          const { score, economics } = scoreAt(purchasePrice);
          return {
            purchasePrice,
            score,
            recommendation: recommendationAt(purchasePrice, thresholds),
            economics,
          };
        })()
      : null;

  return { atPrice, thresholds, factors };
}
