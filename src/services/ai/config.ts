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
    /**
     * Sonnet, dal 2026-09-10. Prima era Haiku, e la scommessa era che leggere
     * "Canon" e "AE-1" su una foto decente non richiedesse il modello piu'
     * capace.
     *
     * Quella scommessa era stata verificata su uno schema di quattro campi, e
     * su quello regge ancora: `bench/compare-models.mjs` chiede nome, marca,
     * modello e confidenza, e su una Olivetti Valentine Haiku risponde
     * "Valentine" per 0,0035 $. Ma non e' lo schema che l'applicazione usa.
     * Attraverso quello vero — objectType, difetti, controlli fisici,
     * attribuzione, query di ricerca — Haiku ha letto il modello giusto 2
     * volte su 9 sulla stessa foto: otto risposte "Lettera 32" o "Valentino"
     * su una macchina che porta "valentine" scritto in rilievo sul frontale.
     * Sonnet, stesso schema e stessa foto: 3 su 3, con le prove ancorate a
     * cio' che si vede.
     *
     * Non e' una preferenza di modello, e' aritmetica del prodotto: se marca e
     * modello sono sbagliati, le query eBay cercano un altro oggetto e tutto
     * cio' che segue — comparabili, fascia, verdetto, prezzo massimo — e' il
     * prezzo di quell'altro oggetto. Un'identificazione sbagliata non degrada
     * la stima: la sostituisce, senza dirlo.
     *
     * Costa piu' del triplo: 0,0035 $ → 0,0128 $ misurati sulla stessa foto.
     * Per tornare indietro basta rimettere 'claude-haiku-4-5-20251001' qui —
     * ma se un giorno lo schema dimagrisse, la scelta andrebbe rimisurata
     * contro lo schema vero, non ripristinata a memoria.
     */
    model: 'claude-sonnet-5',

    /**
     * Il modello a cui si torna se quello economico rifiuta la richiesta per
     * una capacita' che non ha. Costa piu' del doppio, ma un 400 non consuma
     * token: meglio pagare l'analisi che restituire un errore a chi e' davanti
     * a un banco. Se compare nei log, la scelta sopra e' sbagliata.
     */
    fallbackModel: 'claude-opus-5',

    /**
     * low | medium | high | xhigh | max, oppure null per i modelli che non
     * accettano il parametro: Haiku 4.5 risponde 400 se lo riceve. Sonnet lo
     * accetterebbe, ma resta null perche' l'identificazione misurata sopra e'
     * stata fatta cosi': alzarlo e' un'altra scelta, con un'altra misura.
     */
    effort: null as 'low' | 'medium' | 'high' | null,
    maxTokens: 8000,
  },
  /**
   * Testo dell'annuncio, generato solo su richiesta da un oggetto gia' salvato
   * e gia' identificato. Stessa scelta di modello dell'identificazione, per lo
   * stesso motivo: qui il compito e' scrivere in italiano naturale a partire
   * da fatti gia' verificati, non decidere nulla. Il prezzo non passa di qui:
   * lo calcola `services/listing/price.ts` dalla valutazione salvata.
   */
  listing: {
    model: 'claude-haiku-4-5-20251001',
    fallbackModel: 'claude-opus-5',
    effort: null as 'low' | 'medium' | 'high' | null,
    maxTokens: 2000,
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
      'claude-haiku-4-5-20251001': { inputPerMTok: 1, outputPerMTok: 5 },
    },
    /** Scrittura in cache a 5 minuti: 1,25x l'input. Lettura: 0,1x. */
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
    /** 10 $ ogni 1.000 ricerche. web_fetch non ha costo per richiesta. */
    webSearchUsd: 0.01,
  },
} as const;

export type ResearchLane = (typeof researchLanes)[number];
