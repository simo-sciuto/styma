import type { Identification } from '@/schemas/identification';
import type { Comparable, MarketResearch } from '@/schemas/market';
import type { Valuation, ValuationConfidence, WeightedComparable } from '@/schemas/analysis';
import { valuationConfig } from './config';
import { evaluateComparable, weightedMean, weightedPercentile } from './comparables';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const roundToFive = (value: number) => Math.max(1, Math.round(value / 5) * 5);

function confidenceLabel(score: number): ValuationConfidence {
  const { high, medium } = valuationConfig.confidenceLabelThresholds;
  if (score >= high) return 'high';
  if (score >= medium) return 'medium';
  return 'low';
}

/**
 * Toglie dal campione i prezzi troppo lontani dal mediano per essere veri.
 *
 * Il mediano e' resistente agli estremi, quindi si puo' misurare la distanza
 * da li' senza che l'outlier sposti il proprio metro di giudizio. Sotto tre
 * punti non si scarta nulla: con due prezzi molto diversi non c'e' modo di
 * sapere quale sia quello sbagliato.
 */
function rejectOutliers(
  used: WeightedComparable[],
  discarded: { comparable: Comparable; reason: string }[],
): void {
  const { outlierFactor, outlierMinimumSample } = valuationConfig;
  if (used.length < outlierMinimumSample) return;

  const prices = used.map((item) => item.saleEstimateEur).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)]!;
  if (median <= 0) return;

  for (let index = used.length - 1; index >= 0; index -= 1) {
    const ratio = used[index]!.saleEstimateEur / median;
    if (ratio > outlierFactor || ratio < 1 / outlierFactor) {
      discarded.push({
        comparable: used[index]!.comparable,
        reason: `Prezzo fuori scala rispetto agli altri comparabili (${Math.round(ratio > 1 ? ratio : 1 / ratio)}x): piu' probabile un errore che un mercato`,
      });
      used.splice(index, 1);
    }
  }
}

/**
 * Trasforma i comparabili in una forbice di mercato.
 * Il modello linguistico non entra mai in questo calcolo: qui si lavora
 * solo sui dati raccolti e sui pesi configurati.
 */
export function valuate(identification: Identification, research: MarketResearch | null): Valuation {
  const evaluations = (research?.comparables ?? []).map((comparable) =>
    evaluateComparable(comparable, identification.condition),
  );

  const used: WeightedComparable[] = [];
  const discarded: { comparable: Comparable; reason: string }[] = [];

  for (const evaluation of evaluations) {
    if (evaluation.kept) used.push(evaluation.value);
    else discarded.push({ comparable: evaluation.comparable, reason: evaluation.reason });
  }

  rejectOutliers(used, discarded);

  const effectiveSample = used.reduce((sum, item) => sum + item.weight, 0);
  const { minimumViable } = valuationConfig;
  const tooFewComparables =
    used.length < minimumViable.comparables || effectiveSample < minimumViable.effectiveSample;

  if (used.length === 0 || tooFewComparables) {
    return {
      available: false,
      reason:
        research === null
          ? 'La ricerca di mercato non e’ stata completata.'
          : used.length === 0
            ? 'Non abbiamo trovato vendite comparabili abbastanza affidabili per stimare un valore.'
            : `Abbiamo trovato solo ${used.length} comparabile utilizzabile: troppo poco per una forbice onesta.`,
      discarded,
    };
  }

  used.sort((a, b) => b.weight - a.weight);

  let low = weightedPercentile(used, 0.25);
  let high = weightedPercentile(used, 0.75);

  /**
   * Il valore probabile e' la media pesata, non il mediano: su tre o quattro
   * punti il mediano pesato finisce sul bordo della forbice e il risultato
   * si legge come "fra 190 e 545, probabile 545", che non aiuta nessuno.
   */
  const likely = Math.min(high, Math.max(low, weightedMean(used)));

  /**
   * Con pochi punti la forbice osservata sottostima l'incertezza reale:
   * la allarghiamo fino a un minimo che decresce al crescere del campione.
   */
  const sampleFullness = clamp01(effectiveSample / valuationConfig.effectiveSampleTargets.high);
  const { smallSample, largeSample } = valuationConfig.minimumSpread;
  const minimumSpread = likely * (smallSample - (smallSample - largeSample) * sampleFullness);
  if (high - low < minimumSpread) {
    low = Math.max(0, likely - minimumSpread / 2);
    high = likely + minimumSpread / 2;
  }

  /** Con meno di tre punti la dispersione non dice nulla: restiamo neutri. */
  const observedDispersion = likely > 0 ? (high - low) / likely : 1;
  const dispersion = observedDispersion;
  const dispersionIsMeaningful = used.length >= valuationConfig.dispersionMeaningfulFrom;
  const soldCount = used.filter((item) => item.comparable.kind === 'sold').length;
  const soldShare = soldCount / used.length;
  const strongCount = used.filter((item) => item.weight >= 0.7).length;

  const { effectiveSampleTargets } = valuationConfig;
  const sampleScore = clamp01(effectiveSample / effectiveSampleTargets.high);
  const dispersionScore = dispersionIsMeaningful ? clamp01(1 - dispersion) : 0.5;
  const imageQualityScore =
    identification.imageQuality === 'good' ? 1 : identification.imageQuality === 'mixed' ? 0.75 : 0.5;

  const rawConfidence = clamp01(
    0.3 * clamp01(identification.confidence) +
      0.25 * sampleScore +
      0.2 * dispersionScore +
      0.15 * soldShare +
      0.1 * imageQualityScore,
  );

  /**
   * La sicurezza del modello non puo' compensare l'assenza di dati:
   * con pochi comparabili la confidenza resta bassa comunque.
   */
  const cappedBySample = valuationConfig.confidenceCaps.reduce(
    (score, { belowEffectiveSample, cap }) =>
      effectiveSample < belowEffectiveSample ? Math.min(score, cap) : score,
    rawConfidence,
  );

  /**
   * Senza nemmeno una vendita conclusa la confidenza non puo' superare "low",
   * per quanti annunci concordi ci siano: sotto ci sono due incertezze
   * sovrapposte — quanto valgono davvero quegli oggetti, e quanto si scende dal
   * cartellino, che e' un coefficiente assunto e non misurato. Il tetto e'
   * espresso rispetto alla soglia dell'etichetta, non con un numero scelto a
   * mano che le finirebbe sopra al primo ritocco.
   */
  const noSoldDataCap = valuationConfig.confidenceLabelThresholds.medium - 0.01;
  const confidenceScore = soldCount === 0 ? Math.min(cappedBySample, noSoldDataCap) : cappedBySample;

  const reasons: string[] = [];
  reasons.push(
    `${used.length} comparabili usati su ${evaluations.length} trovati, di cui ${soldCount} vendite confermate`,
  );
  if (strongCount > 0) reasons.push(`${strongCount} comparabili molto vicini all’oggetto`);
  if (soldCount < used.length) {
    // Lo sconto applicato ai prezzi richiesti e' un'assunzione dichiarata, non
    // una misura: se resta implicito, la forbice sembra ricavata da vendite.
    const percent = Math.round((1 - valuationConfig.askingToSoldRatio) * 100);
    reasons.push(
      soldCount === 0
        ? `Nessuna vendita confermata: la stima parte dai prezzi richiesti, scontati del ${percent}% perche' un annuncio non e' una vendita`
        : `${used.length - soldCount} prezzi richiesti scontati del ${percent}%: un annuncio non e' una vendita`,
    );
  }
  if (dispersion > 0.6) reasons.push('Prezzi molto dispersi: il mercato non e’ stabile');
  if (effectiveSample < effectiveSampleTargets.medium) {
    reasons.push('Campione ridotto: forbice allargata per riflettere l’incertezza');
  }
  if (!dispersionIsMeaningful) reasons.push('Troppo pochi dati per giudicare la stabilita’ dei prezzi');
  if (identification.confidence < 0.6) reasons.push('Identificazione dell’oggetto incerta');

  return {
    available: true,
    currency: 'EUR',
    low: roundToFive(low),
    likely: roundToFive(likely),
    high: roundToFive(high),
    confidence: confidenceLabel(confidenceScore),
    confidenceScore,
    used,
    discarded,
    strongCount,
    soldCount,
    dispersion,
    reasons,
  };
}
