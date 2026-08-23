import type { Condition } from '@/schemas/identification';
import type { MatchLevel, PriceKind, Currency } from '@/schemas/market';

/**
 * Tutti i numeri che governano valutazione e flip score vivono qui.
 * Sono punti di partenza da tarare sui dati reali, non regole immutabili.
 */
export const valuationConfig = {
  /** Quanto pesa un comparabile in base a quanto assomiglia all'oggetto. */
  matchWeights: {
    exact_model: 1.0,
    same_family: 0.8,
    same_brand: 0.6,
    similar_category: 0.35,
  } satisfies Record<MatchLevel, number>,

  /** Un prezzo richiesto non e' una vendita: pesa meno. */
  kindWeights: {
    sold: 1.0,
    asking: 0.55,
  } satisfies Record<PriceKind, number>,

  /** Piu' e' vecchio il dato, meno conta. */
  recencyWeights: {
    within90Days: 1.0,
    within1Year: 0.85,
    within3Years: 0.6,
    older: 0.4,
    /** Vendita conclusa di cui non conosciamo la data: puo' essere di ieri o di anni fa. */
    unknown: 0.6,
    /**
     * Annuncio attivo senza data. Non e' un dato vecchio: la data manca perche'
     * la vendita non e' avvenuta, non perche' sia lontana. Trattarlo come
     * "forse di tre anni fa" lo penalizzava due volte — una qui e una in
     * kindWeights — e azzerava quasi ogni annuncio che la ricerca web sa
     * trovare, che e' la maggior parte dei dati realmente disponibili.
     */
    activeListing: 1.0,
  },

  /** Penalita' per distanza di stato di conservazione rispetto all'oggetto. */
  conditionWeights: {
    same: 1.0,
    oneStepApart: 0.85,
    twoStepsApart: 0.65,
    farApart: 0.45,
    unknown: 0.7,
  },

  /**
   * Sotto questo peso il comparabile viene scartato.
   *
   * 0,2 e non 0,3: le penalita' si moltiplicano, e un annuncio realistico
   * (stesso modello di famiglia, stato non dichiarato) arrivava a 0,23 e
   * finiva nel cestino. Il peso basso gia' lo fa contare poco nella media:
   * la soglia serve a escludere la spazzatura, non i dati imperfetti.
   */
  minComparableWeight: 0.2,

  /**
   * Quanto un prezzo puo' allontanarsi dal mediano prima di essere considerato
   * un errore invece che un segnale.
   *
   * Fra i comparabili di un'Olivetti Valentine e' comparsa un'aggiudicazione da
   * 45.000 GBP: un lotto diverso, un refuso, o un pezzo da museo. Con la soglia
   * di peso a 0,3 finiva scartata per caso, perche' era vecchia; abbassandola
   * per far entrare gli annunci reali e' entrata anche lei, e ha trascinato la
   * media al soffitto. Un dato fuori scala di cento volte non e' un mercato
   * volatile, e' un dato sbagliato, e va tolto per quello che e'.
   */
  outlierFactor: 5,

  /** Sotto questi punti non si distingue un errore da una coda: non si scarta nulla. */
  outlierMinimumSample: 3,

  /**
   * Da prezzo richiesto a prezzo di vendita atteso.
   *
   * Un annuncio non e' una vendita: su Subito e Vinted si tratta, e si chiude
   * sotto. Scontare e' piu' onesto che scartare — cosi' il dato entra nel
   * calcolo dichiarando cio' che e', invece di sparire e lasciare l'utente
   * senza risposta.
   *
   * E' un'assunzione, non una misura: va verificata contro vendite vere
   * appena ne avremo abbastanza. Finche' resta un'assunzione, l'interfaccia
   * deve dire che la stima viene da prezzi richiesti scontati.
   */
  askingToSoldRatio: 0.75,

  /** Somma dei pesi necessaria per considerare la forbice affidabile. */
  effectiveSampleTargets: {
    high: 6,
    medium: 3,
  },

  /**
   * Sotto questa soglia non produciamo alcuna forbice. Un comparabile solo
   * non e' un mercato: meglio dire che non lo sappiamo.
   */
  minimumViable: {
    comparables: 2,
    /** Vale circa un comparabile pieno: sotto, non c'e' abbastanza evidenza. */
    effectiveSample: 0.8,
  },

  /**
   * Ampiezza minima della forbice, in quota sul valore probabile.
   * Con pochi dati l'incertezza e' maggiore, non minore: la forbice si allarga
   * invece di restringersi attorno ai pochi punti osservati.
   */
  minimumSpread: {
    smallSample: 0.35,
    largeSample: 0.12,
  },

  /** La dispersione osservata ha senso solo con abbastanza punti. */
  dispersionMeaningfulFrom: 3,

  /** Tetti di confidenza legati alla dimensione del campione. */
  /** Punteggio minimo per meritare l'etichetta. Sotto la soglia media e' "low". */
  confidenceLabelThresholds: {
    high: 0.7,
    medium: 0.45,
  },

  confidenceCaps: [
    { belowEffectiveSample: 2, cap: 0.44 },
    { belowEffectiveSample: 4, cap: 0.69 },
  ],

  /** Tassi di cambio statici. Sostituire con un feed reale quando serve. */
  fxToEur: {
    EUR: 1,
    USD: 0.92,
    GBP: 1.17,
  } satisfies Record<Currency, number>,
} as const;

export const flipConfig = {
  /** Commissioni marketplace medie (Vinted/eBay/Subito): quota sul venduto. */
  marketplaceFeeRate: 0.1,
  /** Costo medio di spedizione e imballo a carico del venditore. */
  defaultShippingCost: 9,

  /** ROI e profitto a cui il punteggio economico satura. */
  targetRoi: 1.0,
  targetProfitEur: 60,

  /** Pesi delle tre componenti del punteggio. Devono sommare a 1. */
  scoreWeights: {
    profit: 0.5,
    confidence: 0.25,
    liquidity: 0.25,
  },

  /** Soglie di raccomandazione sul punteggio 0-100. */
  recommendationThresholds: {
    buy: 70,
    maybe: 45,
  },

  demandScores: { high: 1, medium: 0.65, low: 0.3, unknown: 0.5 },
  liquidityScores: { fast: 1, average: 0.65, slow: 0.3, unknown: 0.5 },

  /** Penalita' in punti sul punteggio finale. */
  penalties: {
    /** Mercato volatile: applicata in proporzione alla dispersione. */
    maxVolatility: 12,
    poorCondition: 8,
    fairCondition: 4,
  },
} as const;

/** Ordine usato per misurare la distanza fra due stati di conservazione. */
export const CONDITION_ORDER: Condition[] = ['mint', 'excellent', 'good', 'fair', 'poor'];
