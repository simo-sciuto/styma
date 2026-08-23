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
    id: 'auctions',
    label: 'aggiudicazioni e aste',
    maxSearches: 3,
    maxFetches: 1,
    /**
     * Sostituisce la vecchia corsia "vendite concluse", che su una Canon AE-1
     * ha restituito zero: le pagine dei venduti eBay non sono raggiungibili
     * dalla ricerca web. Gli archivi d'asta, invece, pubblicano i risultati
     * come pagine indicizzate, quindi il mandato ha almeno senso.
     *
     * I domini erano fissati con `allowed_domains`. Misurato e tolto: filtra
     * l'indice di ricerca, non solo le pagine, e le tre corsie sono passate da
     * sette comparabili a zero mentre i token di input salivano del 70%. La
     * direzione si da' col mandato, che non costa niente e non taglia fuori
     * quello che il motore sa trovare.
     */
    mandate: `Cerca aggiudicazioni: prezzi a cui un pezzo del genere e' stato realmente battuto.
Gli archivi d'asta pubblicano i risultati, quindi qui le vendite concluse esistono davvero.
kind "sold" solo se la pagina mostra il prezzo di aggiudicazione; se mostra solo la stima
pre-asta, non e' una vendita e non va riportata.
Se questo oggetto non passa dalle aste, restituisci comparables vuoto senza insistere: e'
un esito normale per la merce corrente, e le altre corsie stanno coprendo quel mercato.`,
  },
  {
    id: 'listings',
    label: 'annunci italiani',
    maxSearches: 3,
    maxFetches: 1,
    mandate: `Cerca annunci attivi sul mercato italiano. Sono prezzi richiesti, quindi kind "asking"
sempre, anche quando il prezzo sembra realistico: la valutazione li sconta per conto suo.
E' la corsia che nella pratica trova piu' dati: puntare a 4-6 annunci dello stesso modello
vale piu' che trovarne due perfetti.
Annota in notes se lo stesso oggetto risulta invenduto da tempo o ricompare spesso.`,
  },
  {
    id: 'international',
    label: 'mercato estero',
    maxSearches: 3,
    maxFetches: 1,
    mandate: `Cerca lo stesso oggetto fuori dall'Italia, in inglese, tedesco e francese. Servono a
capire se il prezzo italiano e' allineato o fuori mercato.
Anche qui quasi tutto sara' kind "asking".
In notes segnala quali varianti valgono di piu' e se la spedizione dall'estero cambia i conti.`,
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
     * Se la ricerca agentica puo' partire quando le fonti strutturate non
     * bastano.
     *
     * Misurato: ~0,96 $ per tre corsie, contro i 4 centesimi di un'analisi
     * che si ferma a eBay. Trenta volte tanto, e l'86% se ne va in token di
     * input perche' ogni risultato di ricerca rientra in contesto a ogni giro.
     *
     * Spenta per scelta. Da quando eBay copre gli oggetti con marca e modello,
     * e da quando la valutazione usa anche i comparabili di categoria invece di
     * scartarli, il caso che restava era l'oggetto anonimo *e* introvabile su
     * eBay — dove peraltro le corsie hanno reso zero comparabili su una Panton
     * Chair. Un euro e trenta per quel caso non si giustifica.
     *
     * Accendendola si torna a pagarla: e' una decisione economica, non tecnica.
     */
    agenticFallback: false,

    /**
     * Se comprare la sola corsia delle aste sugli oggetti di valore che non
     * hanno nemmeno una vendita confermata.
     *
     * L'idea regge — gli archivi d'asta sono l'unica fonte di aggiudicazioni
     * rimasta — ma non l'ho mai vista restituire un comparabile. Spenta finche'
     * non ci sara' una misura che dice quanto rende: pagare ~0,40 $ a oggetto
     * per qualcosa che non ha mai prodotto nulla e' esattamente il modo in cui
     * i costi crescono senza che nessuno se ne accorga.
     */
    buySoldData: false,

    /**
     * Sonnet e non Opus: qui il lavoro e' cercare ed estrarre, non ragionare.
     * L'onesta' dei dati non dipende dall'intelligenza del modello ma dallo
     * schema Zod e dall'aritmetica in `services/valuation`, che non cambiano.
     *
     * Haiku e' stato provato e scartato, non per la qualita' ma per la
     * meccanica: non supporta il programmatic tool calling, quindi le ricerche
     * andrebbero chiamate con `allowed_callers: ["direct"]`, cioe' senza filtro
     * dinamico, con ogni risultato intero in contesto. Costa un terzo per token
     * ma ne consumerebbe molti di piu': il conto non torna, e la qualita'
     * peggiorerebbe in cambio di niente. Rifiuta anche `output_config.effort`.
     */
    model: 'claude-sonnet-5',
    /**
     * Ogni corsia ha un mandato stretto e poche ricerche: non le serve ragionare
     * a lungo, e i token di ragionamento si generano in serie, quindi sono tempo
     * oltre che denaro.
     *
     * `null` per i modelli che non accettano il parametro: Haiku 4.5 risponde
     * 400 se lo riceve. Va tenuto insieme al modello, perche' cambiare l'uno
     * senza guardare l'altro rompe tutte le corsie in una volta.
     */
    effort: 'low' as 'low' | 'medium' | 'high' | null,
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

    /**
     * Sopra quale stima vale la pena pagare una corsia per cercare vendite vere.
     *
     * Gli archivi d'asta sono l'unica fonte di aggiudicazioni ancora
     * raggiungibile: la Marketplace Insights di eBay e' chiusa a nuovi utenti e
     * la vecchia Finding API risponde 418. Quella corsia costa qualche decina di
     * centesimo, quindi ha senso su un pezzo da 500 euro e non su uno da 90:
     * sotto, l'incertezza che toglie vale meno di quello che costa.
     *
     * La decisione si prende sulla stima preliminare ricavata dalle inserzioni,
     * non su un'impressione: e' un dato che a quel punto abbiamo gia'.
     */
    soldDataWorthItAboveEur: 150,
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
