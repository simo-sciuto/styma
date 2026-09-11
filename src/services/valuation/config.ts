import type { Condition } from '@/schemas/identification';
import type { MatchLevel, Currency } from '@/schemas/market';

/**
 * Tutti i numeri che governano valutazione e flip score vivono qui.
 * Sono punti di partenza da tarare sui dati reali, non regole immutabili.
 */
export const valuationConfig = {
  /**
   * Quanto pesa un comparabile in base a quanto assomiglia all'oggetto.
   *
   * Non decide piu' se un comparabile entra nel calcolo — quello lo decide il
   * livello (`identical`/`similar`/`weak`) in `valuate.ts`. Qui resta solo per
   * ordinare i comparabili dentro il livello `similar`, dove same_family conta
   * piu' di similar_category anche se nessuno dei due e' lo stesso modello.
   */
  matchWeights: {
    exact_model: 1.0,
    same_family: 0.8,
    same_brand: 0.6,
    similar_category: 0.35,
  } satisfies Record<MatchLevel, number>,

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

  /** Somma dei pesi necessaria per considerare la fascia affidabile. */
  effectiveSampleTargets: {
    high: 6,
    medium: 3,
  },

  /**
   * Sotto questa soglia non produciamo alcuna fascia. Un comparabile solo
   * non e' un mercato: meglio dire che non lo sappiamo.
   */
  minimumViable: {
    comparables: 2,
    /** Vale circa un comparabile pieno: sotto, non c'e' abbastanza evidenza. */
    effectiveSample: 0.8,
  },

  /**
   * Ampiezza minima della fascia, in quota sul valore probabile.
   * Con pochi dati l'incertezza e' maggiore, non minore: la fascia si allarga
   * invece di restringersi attorno ai pochi punti osservati.
   */
  minimumSpread: {
    smallSample: 0.35,
    largeSample: 0.12,
  },

  /** La dispersione osservata ha senso solo con abbastanza punti. */
  dispersionMeaningfulFrom: 3,

  /** Punteggio minimo per meritare l'etichetta. Sotto la soglia media e' "low". */
  confidenceLabelThresholds: {
    high: 0.7,
    medium: 0.45,
  },

  /**
   * Tetti di confidenza legati a *cosa* si sta confrontando, non a quanti
   * comparabili ci sono.
   *
   * Deciso il 2026-09-09: la stima si basa solo su prezzi richiesti — non
   * possiamo verificare le vendite, quindi non fingiamo di stimarle. Diventa
   * allora decisivo se i prezzi confrontati sono dello stesso identico
   * oggetto o solo di oggetti simili: due incertezze diverse.
   *
   * - `identical`: solo lo stesso modello. Nessun tetto oltre a quelli sul
   *   campione: un campione ampio e concorde di oggetti davvero uguali puo'
   *   arrivare a "high".
   * - `similar`: nessun oggetto identico a sufficienza, si include anche
   *   marca/famiglia/categoria vicina. Tetto a "medium": non e' piu' lo
   *   stesso oggetto, e dirlo "high" affermerebbe una precisione che i dati
   *   non hanno.
   * - `weak`: nemmeno quello, solo comparabili di categoria. La fascia e'
   *   un ordine di grandezza, non una stima, e resta su "low".
   */
  comparableTierConfidenceCaps: {
    similar: 0.69,
    weak: 0.2,
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

  /** ROI e profitto a cui il punteggio economico satura. */
  targetRoi: 1.0,
  targetProfitEur: 60,

  /**
   * Pesi delle tre componenti del punteggio. Devono sommare a 1.
   *
   * Il peso della liquidita' vale solo quando domanda e liquidita' sono state
   * davvero osservate. Non lo sono quasi mai: si vedono solo con la ricerca
   * agentica, spenta per costo, e senza quella valgono sempre "unknown", cioe'
   * 0,5 fisso per ogni oggetto. Lasciarlo pesare comunque significava regalare
   * dodici punti e mezzo a chiunque e schiacciare tutti i punteggi fra 12 e 87,
   * diluendo i due fattori che discriminano davvero. Quando il mercato non e'
   * stato osservato quel peso si ridistribuisce, in proporzione a quello che
   * profitto e confidenza gia' pesavano. Vedi `effectiveWeights` in
   * `flip-score.ts`.
   */
  scoreWeights: {
    profit: 0.5,
    confidence: 0.25,
    liquidity: 0.25,
  },

  /**
   * Il cuscinetto di rischio: la quota del valore atteso che si tiene indietro
   * perche' la stima potrebbe sbagliare.
   *
   * E' la sola parte del prezzo massimo che dipende da quanto siamo sicuri.
   * Chi compra a quel prezzo non deve star scommettendo sulla nostra
   * confidenza: piu' la stima e' fragile, piu' si tiene indietro.
   */
  riskBuffer: {
    /** Tenuto da parte anche nel caso migliore: il mercato si muove comunque. */
    base: 0.05,
    /** Quanto si aggiunge quando la stima non e' solida. */
    byConfidence: { high: 0, medium: 0.08, low: 0.18 },
    /** Prezzi molto dispersi fra loro: aggiunta a dispersione piena. */
    maxDispersion: 0.1,
    /** Uno stato problematico si paga in rivendita, non solo in trattativa. */
    byCondition: { poor: 0.12, fair: 0.06 },
    /** Oltre questo il cuscinetto mangerebbe la stima intera. */
    cap: 0.4,
  },

  /**
   * Quanto vuoi guadagnare su quello che spendi, perche' sia un affare e non
   * solo una trattativa che regge.
   *
   * Sul **capitale investito**, non sul prezzo di vendita. Sembrava lo stesso
   * ed era la differenza fra un prodotto usabile e uno no: la spedizione costa
   * 9 € tanto su un oggetto da 45 € quanto su uno da 550, e si toglie prima
   * della quota. Prendendo il 25% del venduto, la stessa riga di
   * configurazione pretendeva un ritorno del 163% sotto i 50 € e del 95% sopra
   * i 500. Su una fascia 30–70 € l'affare partiva sotto i 12 €: un numero che
   * nessun rivenditore riconosce, accanto a una stima che ne diceva un altro.
   *
   * 0,5 vuol dire: a prezzo massimo ti resta in mano meta' di quello che hai
   * speso, netta di commissioni, spedizione e cuscinetto di rischio. E' la
   * soglia fra «compralo» e «tratta», non l'obiettivo di una vita: sopra
   * quella cifra i conti tornano ancora, guadagni solo meno.
   *
   * Da non confondere con `targetRoi` qui sopra, che e' un'altra cosa: quello
   * dice a che ritorno il *punteggio* smette di salire, questo dove finisce
   * il «compralo».
   */
  dealRoi: 0.5,

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
