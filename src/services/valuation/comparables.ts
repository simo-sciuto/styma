import type { Condition } from '@/schemas/identification';
import type { Comparable } from '@/schemas/market';
import type { WeightedComparable } from '@/schemas/analysis';
import { CONDITION_ORDER, valuationConfig } from './config';

const DAY_MS = 24 * 60 * 60 * 1000;

function recencyWeight(comparable: Comparable): number {
  const { recencyWeights } = valuationConfig;
  const { soldAt, kind } = comparable;

  // Un annuncio attivo non ha data perche' non e' ancora una vendita, non
  // perche' sia vecchio: e' esposto adesso.
  const missing = kind === 'asking' ? recencyWeights.activeListing : recencyWeights.unknown;

  if (!soldAt) return missing;
  const timestamp = Date.parse(soldAt);
  if (Number.isNaN(timestamp)) return missing;

  const ageDays = (Date.now() - timestamp) / DAY_MS;
  if (ageDays < 0) return recencyWeights.unknown; // data futura: dato sospetto
  if (ageDays <= 90) return recencyWeights.within90Days;
  if (ageDays <= 365) return recencyWeights.within1Year;
  if (ageDays <= 365 * 3) return recencyWeights.within3Years;
  return recencyWeights.older;
}

function conditionWeight(objectCondition: Condition, comparableCondition: Condition): number {
  const { conditionWeights } = valuationConfig;
  const a = CONDITION_ORDER.indexOf(objectCondition);
  const b = CONDITION_ORDER.indexOf(comparableCondition);
  if (a < 0 || b < 0) return conditionWeights.unknown;

  const distance = Math.abs(a - b);
  if (distance === 0) return conditionWeights.same;
  if (distance === 1) return conditionWeights.oneStepApart;
  if (distance === 2) return conditionWeights.twoStepsApart;
  return conditionWeights.farApart;
}

export type ComparableEvaluation =
  | { kept: true; value: WeightedComparable }
  | {
      kept: false;
      comparable: Comparable;
      reason: string;
      /**
       * Presente quando lo scarto e' solo questione di peso, non di dato
       * inutilizzabile. Serve a poterli ripescare: se non c'e' niente di
       * meglio, diciannove annunci deboli dicono piu' di un "non lo so".
       */
      weak?: WeightedComparable;
    };

export function evaluateComparable(
  comparable: Comparable,
  objectCondition: Condition,
  askingToSoldRatio: number = valuationConfig.askingToSoldRatio,
): ComparableEvaluation {
  if (!Number.isFinite(comparable.price) || comparable.price <= 0) {
    return { kept: false, comparable, reason: 'Prezzo non valido' };
  }

  const rate = valuationConfig.fxToEur[comparable.currency];
  const priceEur = Math.round(comparable.price * rate * 100) / 100;

  // Il prezzo osservato resta quello che si legge sulla pagina; il calcolo usa
  // il prezzo di vendita atteso. Tenerli separati permette di mostrare
  // entrambi, invece di far apparire uno sconto come se fosse il cartellino.
  const saleEstimateEur =
    comparable.kind === 'asking'
      ? Math.round(priceEur * askingToSoldRatio * 100) / 100
      : priceEur;

  const weightBreakdown = {
    match: valuationConfig.matchWeights[comparable.matchLevel],
    kind: valuationConfig.kindWeights[comparable.kind],
    recency: recencyWeight(comparable),
    condition: conditionWeight(objectCondition, comparable.condition),
  };

  const weight =
    weightBreakdown.match *
    weightBreakdown.kind *
    weightBreakdown.recency *
    weightBreakdown.condition;

  if (weight < valuationConfig.minComparableWeight) {
    return {
      kept: false,
      comparable,
      reason: 'Comparabile troppo debole (somiglianza, eta’ o stato non allineati)',
      weak: { comparable, priceEur, saleEstimateEur, weight, weightBreakdown },
    };
  }

  return { kept: true, value: { comparable, priceEur, saleEstimateEur, weight, weightBreakdown } };
}

/**
 * Percentile su una distribuzione pesata: ogni comparabile occupa
 * sulla retta una porzione pari al proprio peso.
 */
export function weightedPercentile(items: WeightedComparable[], percentile: number): number {
  const sorted = [...items].sort((a, b) => a.saleEstimateEur - b.saleEstimateEur);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return sorted[0]?.saleEstimateEur ?? 0;

  const target = totalWeight * percentile;
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= target) return item.saleEstimateEur;
  }
  return sorted[sorted.length - 1]!.saleEstimateEur;
}

/** Media pesata: con campioni piccoli e' piu' stabile del mediano, che salta fra i pochi punti osservati. */
export function weightedMean(items: WeightedComparable[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return items[0]?.saleEstimateEur ?? 0;
  return items.reduce((sum, item) => sum + item.saleEstimateEur * item.weight, 0) / totalWeight;
}
