/**
 * Configurazione del provider AI. Tenuta separata dal codice di chiamata
 * per poter tarare modello, effort e budget senza toccare la logica.
 */

/**
 * La ricerca di mercato e' divisa in corsie che girano in parallelo.
 *
 * Un unico agente con dodici ricerche a disposizione le fa in serie: cerca,
 * ragiona sul risultato, cerca ancora. Il tempo totale e' la somma dei giri.
 * Tre corsie da quattro ricerche costano invece quanto la piu' lenta delle tre.
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
    maxSearches: 4,
    maxFetches: 2,
    mandate: `Cerca solo vendite realmente concluse: eBay "venduti", aggiudicazioni d'asta, archivi di
risultati (Catawiki conclusi, case d'asta, LiveAuctioneers, Invaluable, Barnebys).
E' la corsia che pesa di piu' nella valutazione: un prezzo di aggiudicazione vale piu' di dieci
annunci. Se una pagina non conferma che la vendita e' avvenuta, non e' roba tua: lasciala alle
altre corsie invece di declassarla ad "asking".`,
  },
  {
    id: 'listings',
    label: 'annunci attivi',
    maxSearches: 4,
    maxFetches: 2,
    mandate: `Cerca solo annunci attivi sul mercato italiano: Subito, Vinted, eBay inserzioni in corso,
Etsy, negozi di modernariato e mercatini online. Sono prezzi richiesti, quindi kind "asking"
sempre, anche quando il prezzo sembra realistico.
Annota in notes se lo stesso oggetto risulta invenduto da tempo o ricompare spesso: dice piu'
del prezzo esposto.`,
  },
  {
    id: 'international',
    label: 'mercato estero e contesto',
    maxSearches: 4,
    maxFetches: 2,
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
    /** low | medium | high | xhigh | max. In campo la latenza conta: partiamo da medium. */
    effort: 'medium' as const,
    maxTokens: 16000,
  },
  research: {
    model: 'claude-opus-5',
    /**
     * Ogni corsia ha un mandato stretto e poche ricerche: non le serve ragionare
     * a lungo, e i token di ragionamento si generano in serie, quindi sono tempo.
     */
    effort: 'low' as const,
    maxTokens: 8000,
    lanes: researchLanes,
    /** Giri massimi del loop di tool use, per corsia, prima di arrenderci. */
    maxIterations: 5,
  },
  /** Mercato di riferimento: orienta i risultati di ricerca. */
  market: {
    country: 'IT',
    timezone: 'Europe/Rome',
  },
} as const;

export type ResearchLane = (typeof researchLanes)[number];
