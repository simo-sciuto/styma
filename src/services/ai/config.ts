/**
 * Configurazione del provider AI. Tenuta separata dal codice di chiamata
 * per poter tarare modello, effort e budget senza toccare la logica.
 */

/**
 * La ricerca di mercato e' divisa in corsie che girano in parallelo.
 *
 * Un unico agente con dodici ricerche a disposizione le fa in serie: cerca,
 * ragiona sul risultato, cerca ancora. Il tempo totale e' la somma dei giri.
 * Tre corsie da tre ricerche costano invece quanto la piu' lenta delle tre.
 *
 * Perche' funzioni i mandati devono essere disgiunti: se due corsie cercano
 * la stessa cosa il tempo si dimezza ma i dati no. I duplicati che restano
 * li toglie `mergeMarketResearch`, che e' l'unica difesa contro una stessa
 * pagina contata due volte (e quindi contro una confidenza gonfiata).
 */
const researchLanes = [
  {
    id: 'sold',
    label: 'vendite concluse',
    maxSearches: 3,
    maxFetches: 1,
    mandate: `Cerca solo vendite realmente concluse: eBay "venduti", aggiudicazioni d'asta, archivi di
risultati (Catawiki conclusi, case d'asta, LiveAuctioneers, Invaluable, Barnebys).
E' la corsia che pesa di piu' nella valutazione: un prezzo di aggiudicazione vale piu' di dieci
annunci. Se una pagina non conferma che la vendita e' avvenuta, non e' roba tua: lasciala alle
altre corsie invece di declassarla ad "asking".`,
  },
  {
    id: 'listings',
    label: 'annunci attivi',
    maxSearches: 3,
    maxFetches: 1,
    mandate: `Cerca solo annunci attivi sul mercato italiano: Subito, Vinted, eBay inserzioni in corso,
Etsy, negozi di modernariato e mercatini online. Sono prezzi richiesti, quindi kind "asking"
sempre, anche quando il prezzo sembra realistico.
Annota in notes se lo stesso oggetto risulta invenduto da tempo o ricompare spesso: dice piu'
del prezzo esposto.`,
  },
  {
    id: 'international',
    label: 'mercato estero e contesto',
    maxSearches: 3,
    maxFetches: 1,
    mandate: `Cerca fuori dall'Italia e fuori dalle piattaforme generaliste: eBay .de/.fr/.co.uk/.com,
siti specialistici, cataloghi e comunita' di collezionisti. Cerca anche in inglese, tedesco e francese.
Oltre ai comparabili sei tu a leggere il contesto: quali varianti valgono di piu', come si riconosce
un falso o una riproduzione, se c'e' stagionalita', se la spedizione dall'estero cambia i conti.
Mettilo in notes.`,
  },
] as const;

export const aiConfig = {
  identification: {
    model: 'claude-opus-5',
    /**
     * low | medium | high | xhigh | max. Qui Opus si guadagna il prezzo: leggere
     * un punzone sfocato e' la parte difficile, e un'identificazione sbagliata
     * rende inutile tutta la ricerca che segue.
     */
    effort: 'medium' as const,
    maxTokens: 16000,
  },
  research: {
    /**
     * Sonnet e non Opus: qui il lavoro e' cercare ed estrarre, non ragionare.
     * L'onesta' dei dati non dipende dall'intelligenza del modello ma dallo
     * schema Zod e dall'aritmetica in `services/valuation`, che non cambiano.
     * Costa il 40% in meno per token. Se la qualita' dei comparabili peggiora,
     * e' la prima riga da rimettere a `claude-opus-5`.
     */
    model: 'claude-sonnet-5',
    /**
     * Ogni corsia ha un mandato stretto e poche ricerche: non le serve ragionare
     * a lungo, e i token di ragionamento si generano in serie, quindi sono tempo
     * oltre che denaro.
     */
    effort: 'low' as const,
    maxTokens: 8000,
    /**
     * Tetto al testo che una singola pagina puo' portare in contesto. Senza,
     * un PDF d'asta da 500 kB vale 125.000 token di input — e li ripaga a ogni
     * giro successivo del loop, perche' la conversazione viene rimandata intera.
     */
    maxFetchContentTokens: 6000,
    lanes: researchLanes,
    /** Giri massimi del loop di tool use, per corsia, prima di arrenderci. */
    maxIterations: 5,
  },
  /** Mercato di riferimento: orienta i risultati di ricerca. */
  market: {
    country: 'IT',
    timezone: 'Europe/Rome',
  },
  /**
   * Listino per stimare il costo di un'analisi. Non e' fatturazione: serve a
   * rendere visibile una spesa che altrimenti si scopre solo a fine mese.
   * Dollari per milione di token, allineato al listino pubblico.
   */
  pricing: {
    models: {
      'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25 },
      'claude-sonnet-5': { inputPerMTok: 3, outputPerMTok: 15 },
      'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
    },
    /** Scrittura in cache a 5 minuti: 1,25x l'input. Lettura: 0,1x. */
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
    /** 10 $ ogni 1.000 ricerche. web_fetch non ha costo per richiesta. */
    webSearchUsd: 0.01,
  },
} as const;

export type ResearchLane = (typeof researchLanes)[number];
