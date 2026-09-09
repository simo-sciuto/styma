import type { Condition } from '@/schemas/identification';
import type { Comparable } from '@/schemas/market';
import type { WeightedComparable } from '@/schemas/analysis';
import { CONDITION_ORDER, valuationConfig } from './config';

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

export function evaluateComparable(comparable: Comparable, objectCondition: Condition): ComparableEvaluation {
  if (!Number.isFinite(comparable.price) || comparable.price <= 0) {
    return { kept: false, comparable, reason: 'Prezzo non valido' };
  }

  const rate = valuationConfig.fxToEur[comparable.currency];
  const priceEur = Math.round(comparable.price * rate * 100) / 100;

  const weightBreakdown = {
    match: valuationConfig.matchWeights[comparable.matchLevel],
    condition: conditionWeight(objectCondition, comparable.condition),
  };

  const weight = weightBreakdown.match * weightBreakdown.condition;

  if (weight < valuationConfig.minComparableWeight) {
    return {
      kept: false,
      comparable,
      reason: 'Comparabile troppo debole (somiglianza o stato non allineati)',
      weak: { comparable, priceEur, weight, weightBreakdown },
    };
  }

  return { kept: true, value: { comparable, priceEur, weight, weightBreakdown } };
}

/**
 * Percentile su una distribuzione pesata: ogni comparabile occupa
 * sulla retta una porzione pari al proprio peso.
 */
export function weightedPercentile(items: WeightedComparable[], percentile: number): number {
  const sorted = [...items].sort((a, b) => a.priceEur - b.priceEur);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return sorted[0]?.priceEur ?? 0;

  const target = totalWeight * percentile;
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= target) return item.priceEur;
  }
  return sorted[sorted.length - 1]!.priceEur;
}

/** Media pesata: con campioni piccoli e' piu' stabile del mediano, che salta fra i pochi punti osservati. */
export function weightedMean(items: WeightedComparable[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return items[0]?.priceEur ?? 0;
  return items.reduce((sum, item) => sum + item.priceEur * item.weight, 0) / totalWeight;
}
