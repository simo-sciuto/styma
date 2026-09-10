import type { Identification } from '@/schemas/identification';
import type { Comparable, MarketResearch } from '@/schemas/market';
import type { ComparableTier, Valuation, ValuationConfidence, WeightedComparable } from '@/schemas/analysis';
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

  const prices = used.map((item) => item.priceEur).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)]!;
  if (median <= 0) return;

  for (let index = used.length - 1; index >= 0; index -= 1) {
    const ratio = used[index]!.priceEur / median;
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
 * Trasforma i comparabili in una fascia di mercato.
 * Il modello linguistico non entra mai in questo calcolo: qui si lavora
 * solo sui dati raccolti e sui pesi configurati.
 *
 * Non esiste una fonte gratuita di vendite concluse (eBay lo chiude ai nuovi
 * utenti, Discogs vuole un account venditore): la stima si basa sempre su
 * prezzi richiesti. La domanda che conta allora non e' "e' una vendita?" ma
 * "e' lo stesso oggetto?" — vedi il livello `identical`/`similar`/`weak` qui
 * sotto, che sostituisce la vecchia distinzione sold/asking.
 */
export function valuate(identification: Identification, research: MarketResearch | null): Valuation {
  const evaluations = (research?.comparables ?? []).map((comparable) =>
    evaluateComparable(comparable, identification.condition),
  );

  const cleared: WeightedComparable[] = [];
  const weak: WeightedComparable[] = [];
  const discarded: { comparable: Comparable; reason: string }[] = [];

  for (const evaluation of evaluations) {
    if (evaluation.kept) {
      cleared.push(evaluation.value);
      continue;
    }
    discarded.push({ comparable: evaluation.comparable, reason: evaluation.reason });
    if (evaluation.weak) weak.push(evaluation.weak);
  }

  const { minimumViable } = valuationConfig;
  const isViable = (items: WeightedComparable[]) =>
    items.length >= minimumViable.comparables &&
    items.reduce((sum, item) => sum + item.weight, 0) >= minimumViable.effectiveSample;

  const identical = cleared.filter((item) => item.comparable.matchLevel === 'exact_model');

  /**
   * Tre livelli, in ordine di quanto ci si puo' fidare:
   *
   * 1. `identical` — solo lo stesso modello. E' cio' che si cerca sempre per
   *    primo: il prezzo richiesto di un oggetto davvero uguale, non di uno
   *    che gli somiglia.
   * 2. `similar` — lo stesso modello non basta da solo: si aggiungono marca,
   *    famiglia o categoria vicina. Dichiarato, con un tetto di confidenza.
   * 3. `weak` — nemmeno quello: si ripescano comparabili sotto la soglia di
   *    peso piuttosto che rispondere "non lo so" quando qualcosa c'era
   *    (diciannove annunci di categoria dicono piu' di un rifiuto secco).
   */
  let used: WeightedComparable[];
  let comparableTier: ComparableTier;

  if (isViable(identical)) {
    used = identical;
    comparableTier = 'identical';
    // Il resto ha superato la soglia di peso ma non e' lo stesso modello:
    // qui non entra, e va detto perche' non sparisca senza spiegazione.
    for (const item of cleared) {
      if (item.comparable.matchLevel !== 'exact_model') {
        discarded.push({
          comparable: item.comparable,
          reason: 'Non e’ lo stesso modello: gli annunci identici bastavano gia’ da soli',
        });
      }
    }
  } else if (isViable(cleared)) {
    used = cleared;
    comparableTier = 'similar';
  } else {
    used = [...cleared, ...weak];
    comparableTier = 'weak';
    for (let index = discarded.length - 1; index >= 0; index -= 1) {
      if (weak.some((entry) => entry.comparable === discarded[index]!.comparable)) {
        discarded.splice(index, 1);
      }
    }
  }

  rejectOutliers(used, discarded);

  const effectiveSample = used.reduce((sum, item) => sum + item.weight, 0);
  const tooFewComparables =
    used.length < minimumViable.comparables || effectiveSample < minimumViable.effectiveSample;

  if (used.length === 0 || tooFewComparables) {
    // Anche quando non basta, si mostra cosa si e' visto: un rifiuto secco
    // lascia chi e' davanti al banco esattamente dove stava.
    const seen = [...cleared, ...weak];
    return {
      observed:
        seen.length > 0
          ? {
              count: seen.length,
              lowEur: Math.round(Math.min(...seen.map((entry) => entry.priceEur))),
              highEur: Math.round(Math.max(...seen.map((entry) => entry.priceEur))),
            }
          : null,
      available: false,
      reason:
        research === null
          ? 'La ricerca di mercato non e’ stata completata.'
          : seen.length === 0
            ? 'Non abbiamo trovato annunci comparabili abbastanza affidabili per stimare un valore.'
            : `Abbiamo trovato solo ${seen.length} annunci comparabili: troppo poco per una stima onesta.`,
      discarded,
    };
  }

  used.sort((a, b) => b.weight - a.weight);

  let low = weightedPercentile(used, 0.25);
  let high = weightedPercentile(used, 0.75);

  /**
   * Il valore probabile e' la media pesata, non il mediano: su tre o quattro
   * punti il mediano pesato finisce sul bordo della fascia e il risultato
   * si legge come "fra 190 e 545, probabile 545", che non aiuta nessuno.
   */
  const likely = Math.min(high, Math.max(low, weightedMean(used)));

  /**
   * Con pochi punti la fascia osservata sottostima l'incertezza reale:
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
  const identicalCount = used.filter((item) => item.comparable.matchLevel === 'exact_model').length;
  const strongCount = used.filter((item) => item.weight >= 0.7).length;

  const { effectiveSampleTargets } = valuationConfig;
  const sampleScore = clamp01(effectiveSample / effectiveSampleTargets.high);
  const dispersionScore = dispersionIsMeaningful ? clamp01(1 - dispersion) : 0.5;
  const imageQualityScore =
    identification.imageQuality === 'good' ? 1 : identification.imageQuality === 'mixed' ? 0.75 : 0.5;

  const rawConfidence = clamp01(
    0.35 * clamp01(identification.confidence) +
      0.3 * sampleScore +
      0.25 * dispersionScore +
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
   * Il secondo tetto dipende da *cosa* si sta confrontando: solo un campione
   * di oggetti davvero identici puo' arrivare a "high". Vedi
   * `comparableTierConfidenceCaps` in config.ts per il perche'.
   */
  const tierCap = comparableTier === 'identical' ? 1 : valuationConfig.comparableTierConfidenceCaps[comparableTier];
  const confidenceScore = Math.min(cappedBySample, tierCap);

  const reasons: string[] = [];
  reasons.push(
    comparableTier === 'identical'
      ? `${used.length} annunci dello stesso modello su ${evaluations.length} trovati`
      : `${used.length} comparabili usati su ${evaluations.length} trovati`,
  );
  if (strongCount > 0) reasons.push(`${strongCount} comparabili molto vicini all’oggetto`);
  if (comparableTier === 'similar') {
    reasons.push(
      identicalCount > 0
        ? `Solo ${identicalCount} annunci dello stesso modello: la fascia include anche oggetti simili`
        : 'Nessun annuncio dello stesso modello: la fascia include oggetti simili (stessa marca o famiglia)',
    );
  }
  if (comparableTier === 'weak') {
    reasons.push(
      'Nessun comparabile davvero vicino: la fascia esce da annunci della stessa categoria, non dello stesso modello',
    );
  }
  if (dispersion > 0.6) reasons.push('Prezzi molto dispersi: il mercato non e’ stabile');
  if (effectiveSample < effectiveSampleTargets.medium) {
    reasons.push('Campione ridotto: fascia di prezzo allargata per riflettere l’incertezza');
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
    identicalCount,
    comparableTier,
    dispersion,
    reasons,
  };
}
