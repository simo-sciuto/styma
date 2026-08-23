/**
 * Calibrare lo sconto sui prezzi richiesti con le vendite vere.
 *
 * `askingToSoldRatio` e' l'unico numero del prodotto scelto a tavolino invece
 * che ricavato dai dati, e non per pigrizia: i prezzi di vendita non sono
 * acquistabili da nessuna fonte gratuita. Marketplace Insights e' chiusa a
 * nuovi utenti, la Finding API risponde 418, Discogs vuole OAuth da venditore.
 *
 * Ma chi usa STYMA vende davvero, e il prezzo lo registra. Ogni oggetto
 * venduto e' quindi un confronto fra cio' che avevamo stimato dagli annunci e
 * cio' che il mercato ha pagato — un dato che nessuno vende, perche' e' nostro.
 */

export type SaleObservation = {
  /** Valore probabile mostrato all'epoca, gia' scontato. */
  likelyValue: number;
  /** Sconto applicato allora: senza, la riga non e' confrontabile. */
  ratioUsed: number;
  /** Vendite confermate fra i comparabili di allora. */
  soldComparableCount: number;
  /** Prezzo a cui l'oggetto e' stato realmente venduto. */
  salePrice: number;
};

export type Calibration = {
  /** Osservazioni utilizzabili. */
  samples: number;
  /** Rapporto osservato fra prezzo di vendita e prezzo richiesto. */
  observedRatio: number;
  /** Scarto fra la meta' piu' bassa e quella piu' alta: dice quanto fidarsi. */
  spread: number;
  /** Se il campione basta per sostituire l'assunzione. */
  usable: boolean;
};

/**
 * Sotto questo numero di vendite il rapporto osservato e' rumore.
 *
 * Applicare una media di tre vendite sarebbe peggio dell'assunzione che
 * sostituisce: l'assunzione almeno e' stabile, mentre una media minuscola
 * salta a ogni nuova riga e sposterebbe le stime senza motivo.
 */
export const MINIMUM_SAMPLES = 12;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
};

/**
 * Solo le stime ricavate *soltanto* da annunci dicono qualcosa sullo sconto.
 * Se fra i comparabili c'erano gia' vendite concluse, il valore probabile non
 * era il prezzo richiesto scontato, e confrontarlo misurerebbe altro.
 */
function isInformative(observation: SaleObservation): boolean {
  return (
    observation.soldComparableCount === 0 &&
    observation.ratioUsed > 0 &&
    observation.likelyValue > 0 &&
    observation.salePrice > 0
  );
}

/**
 * Dal valore mostrato si risale al prezzo richiesto medio dividendo per lo
 * sconto che era stato applicato; il rapporto osservato e' quanto ci si e'
 * ricavato davvero sopra quella cifra.
 */
function observedRatioOf(observation: SaleObservation): number {
  const askingBaseline = observation.likelyValue / observation.ratioUsed;
  return observation.salePrice / askingBaseline;
}

/**
 * Il mediano e non la media: una singola vendita fortunata a dieci volte la
 * stima sposterebbe la media di tutti, e qui il numero finisce dentro ogni
 * valutazione futura.
 */
export function calibrateAskingToSold(observations: SaleObservation[]): Calibration | null {
  const ratios = observations.filter(isInformative).map(observedRatioOf).filter(Number.isFinite);
  if (ratios.length === 0) return null;

  const sorted = [...ratios].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  const lower = median(sorted.slice(0, Math.max(1, half)));
  const upper = median(sorted.slice(sorted.length - Math.max(1, half)));

  return {
    samples: ratios.length,
    observedRatio: median(ratios),
    spread: upper - lower,
    usable: ratios.length >= MINIMUM_SAMPLES,
  };
}

/** Frase da mostrare a chi vende: e' il suo mercato, misurato sulle sue vendite. */
export function describeCalibration(calibration: Calibration, assumed: number): string {
  const observed = Math.round(calibration.observedRatio * 100);
  const assumedPercent = Math.round(assumed * 100);

  if (!calibration.usable) {
    return `Su ${calibration.samples} vendite registrate i tuoi oggetti si sono chiusi in media al ${observed}% del prezzo richiesto. Ne servono ${MINIMUM_SAMPLES} perche' il dato sostituisca la stima del ${assumedPercent}% che usiamo adesso.`;
  }

  return `Sulle tue ${calibration.samples} vendite gli oggetti si chiudono al ${observed}% del prezzo richiesto, contro il ${assumedPercent}% che assumevamo. Le stime ora usano il tuo numero.`;
}
