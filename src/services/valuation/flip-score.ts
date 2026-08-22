import type { Identification } from '@/schemas/identification';
import type { MarketResearch } from '@/schemas/market';
import type {
  Economics,
  FlipAssessment,
  Recommendation,
  ScoreFactor,
  Valuation,
} from '@/schemas/analysis';
import { flipConfig } from './config';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function economicsAt(purchasePrice: number, expectedSalePrice: number): Economics {
  const marketplaceFees = expectedSalePrice * flipConfig.marketplaceFeeRate;
  const shipping = flipConfig.defaultShippingCost;
  const expectedProfit = expectedSalePrice - purchasePrice - marketplaceFees - shipping;
  const totalCost = purchasePrice + marketplaceFees + shipping;

  return {
    expectedSalePrice,
    purchasePrice,
    marketplaceFees: Math.round(marketplaceFees * 100) / 100,
    shipping,
    expectedProfit: Math.round(expectedProfit * 100) / 100,
    roi: totalCost > 0 ? expectedProfit / totalCost : null,
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

function recommendationFor(score: number): Recommendation {
  if (score >= flipConfig.recommendationThresholds.buy) return 'BUY';
  if (score >= flipConfig.recommendationThresholds.maybe) return 'MAYBE';
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
        (flipConfig.scoreWeights.profit * profitScore +
          flipConfig.scoreWeights.confidence * confidenceScore +
          flipConfig.scoreWeights.liquidity * liquidityScore) -
      penalties;

    return { score: Math.round(Math.min(100, Math.max(0, raw))), economics };
  };

  /** Il punteggio decresce col prezzo di acquisto: cerchiamo la soglia per bisezione. */
  const maxPriceFor = (target: number): number | null => {
    if (scoreAt(0).score < target) return null;
    let lo = 0;
    let hi = expectedSalePrice;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (scoreAt(mid).score >= target) lo = mid;
      else hi = mid;
    }
    return Math.floor(lo);
  };

  const factors: ScoreFactor[] = [];
  if (valuation.strongCount > 0) {
    factors.push({
      label: `${valuation.strongCount} comparabili molto vicini all’oggetto`,
      direction: 'positive',
    });
  }
  if (valuation.soldCount > 0) {
    factors.push({
      label: `${valuation.soldCount} vendite realmente concluse`,
      direction: 'positive',
    });
  } else {
    factors.push({ label: 'Nessuna vendita confermata, solo prezzi richiesti', direction: 'negative' });
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
  factors.push({
    label: `Commissioni e spedizione stimate: ${Math.round(
      expectedSalePrice * flipConfig.marketplaceFeeRate + flipConfig.defaultShippingCost,
    )} €`,
    direction: 'negative',
  });

  const atPrice =
    purchasePrice !== null && Number.isFinite(purchasePrice) && purchasePrice >= 0
      ? (() => {
          const { score, economics } = scoreAt(purchasePrice);
          return { purchasePrice, score, recommendation: recommendationFor(score), economics };
        })()
      : null;

  return {
    atPrice,
    thresholds: {
      buyUpTo: maxPriceFor(flipConfig.recommendationThresholds.buy),
      maybeUpTo: maxPriceFor(flipConfig.recommendationThresholds.maybe),
    },
    factors,
  };
}
