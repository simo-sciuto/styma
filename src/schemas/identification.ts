import * as z from 'zod/v4';

export const CONDITION_LEVELS = [
  'mint',
  'excellent',
  'good',
  'fair',
  'poor',
  'unknown',
] as const;

export const ConditionSchema = z.enum(CONDITION_LEVELS);
export type Condition = z.infer<typeof ConditionSchema>;

/**
 * Quanto in fretta si muove il prezzo di questa categoria di oggetti.
 * Non e' una stima di valore: e' cio' che decide per quanto tempo una
 * ricerca di mercato resta riutilizzabile. Vedi `services/market-cache`.
 */
export const MARKET_PACES = ['slow', 'medium', 'fast'] as const;
export const MarketPaceSchema = z.enum(MARKET_PACES);
export type MarketPace = z.infer<typeof MarketPaceSchema>;

/**
 * Quanto le prove *visibili* sostengono l'attribuzione dichiarata. Non e' una
 * scala da "falso" a "autentico": e' quanta evidenza c'e', e basta.
 *
 * La differenza non e' una sfumatura di linguaggio. Dalle fotografie di un
 * banco nessuno puo' stabilire l'autenticita' di niente, e un prodotto che si
 * pronunciasse comunque farebbe il danno peggiore che sa fare: dare a chi
 * compra la sicurezza che non ha. Quello che si puo' dire e' cosa si vede,
 * cosa non torna e cosa andrebbe guardato meglio.
 */
export const AUTHENTICITY_LEVELS = ['none', 'weak', 'consistent', 'strong'] as const;
export const AuthenticityLevelSchema = z.enum(AUTHENTICITY_LEVELS);
export type AuthenticityLevel = z.infer<typeof AuthenticityLevelSchema>;

export const AuthenticitySchema = z.object({
  level: AuthenticityLevelSchema.describe(
    'Quanta evidenza visibile sostiene l’attribuzione: none (niente da cui partire), weak (qualche indizio, nulla di dirimente), consistent (tutto cio’ che si vede e’ coerente con l’originale, ma nulla lo prova), strong (elementi verificabili: marchio leggibile, numerazione, dettagli costruttivi giusti). Non e’ una scala da falso ad autentico.',
  ),
  supports: z
    .array(z.string())
    .describe(
      'Elementi visibili che sostengono l’attribuzione. Solo cose che si vedono nelle foto: niente nomi di designer, anni o dettagli ricordati a memoria.',
    ),
  concerns: z
    .array(z.string())
    .describe(
      'Elementi che non tornano, se ce ne sono: proporzioni sbagliate, marchio assente dove dovrebbe esserci, materiali o finiture incoerenti con l’epoca. Vuoto se non hai notato niente.',
    ),
  toVerify: z
    .array(z.string())
    .describe(
      'Cosa guardare per sciogliere il dubbio: dove cercare un marchio, quale dettaglio confrontare, cosa misurare.',
    ),
});

export type Authenticity = z.infer<typeof AuthenticitySchema>;

/**
 * What the vision model is allowed to tell us about the object.
 * Deliberately excludes anything about price: market value comes from
 * comparables, never from the model's own guess.
 */
export const IdentificationSchema = z.object({
  name: z.string().describe('Nome dell’oggetto, come lo scriveresti in un annuncio'),
  /**
   * Il discriminante della ricerca dei comparabili, e per questo un campo a
   * se' invece di una sfumatura di `category`: la categoria merceologica e'
   * troppo larga per restringere una ricerca ("abbigliamento" non toglie un
   * solo maglione da una ricerca di polo), e il nome e' una frase intera, che
   * come query non trova niente.
   */
  objectType: z
    .string()
    .describe(
      'Che cosa e’ l’oggetto, in una o due parole, come lo scriverebbe un venditore nel titolo di un annuncio: "polo", "maglione", "vaso", "lampada da tavolo", "reflex 35mm". Senza marca e senza aggettivi.',
    ),
  category: z.string().describe('Categoria merceologica, es. "illuminazione", "ceramica", "orologi"'),
  brand: z.string().nullable().describe('Marca o produttore, null se non identificabile'),
  model: z.string().nullable().describe('Modello o famiglia di prodotto, null se non identificabile'),
  period: z.string().nullable().describe('Epoca stimata, es. "anni 70", "1890-1910", null se ignota'),
  materials: z.array(z.string()).describe('Materiali principali riconosciuti'),
  characteristics: z.array(z.string()).describe('Caratteristiche notevoli utili a distinguere il pezzo'),
  markings: z
    .array(z.string())
    .describe('Marchi, punzoni, firme, etichette, numeri di serie effettivamente LETTI nelle foto'),
  condition: ConditionSchema.describe('Stato di conservazione complessivo'),
  conditionNotes: z.array(z.string()).describe('Difetti visibili: crepe, mancanze, restauri, usura'),
  history: z.string().describe('2-4 frasi di contesto storico o culturale sull’oggetto'),
  confidence: z.number().describe('Quanto sei sicuro dell’identificazione, da 0 a 1'),
  confidenceReasons: z.array(z.string()).describe('Perché la confidenza è alta o bassa'),
  /**
   * Null quando non c'e' nessuna attribuzione da verificare: un vaso senza
   * marca ne' autore non puo' essere ne' vero ne' falso, e riempire il campo
   * comunque insegnerebbe a leggerlo come una formalita' invece che come un
   * segnale.
   */
  authenticity: AuthenticitySchema.nullable().describe(
    'Quanto le prove visibili sostengono marca, modello o attribuzione. Null se non c’e’ nessuna attribuzione da verificare.',
  ),
  imageQuality: z.enum(['good', 'mixed', 'poor']).describe('Qualità complessiva delle foto ricevute'),
  marketPace: MarketPaceSchema.describe(
    'Quanto in fretta invecchia il prezzo di questa categoria: slow (modernariato, design, arte, mobili, libri, dischi), medium (abbigliamento, orologi, ceramiche, giocattoli, biciclette), fast (elettronica, telefoni, computer, console, fotocamere digitali, elettrodomestici). Nel dubbio scegli il piu’ veloce.',
  ),
  missingShots: z
    .array(z.string())
    .describe('Foto aggiuntive che migliorerebbero l’identificazione, se ce ne sono'),
  /**
   * Cosa fare con l'oggetto in mano, prima di pagare.
   *
   * Non e' `missingShots` con altre parole: quelle sono foto che servono a
   * *noi* per identificare meglio, questi sono controlli che servono a *chi
   * compra* e che nessuna fotografia puo' fare al posto suo — un suono, un
   * peso, una giuntura da toccare, un meccanismo da provare.
   */
  physicalChecks: z
    .array(z.string())
    .describe(
      'Da 2 a 5 controlli da fare con l’oggetto in mano prima di comprarlo: cosa toccare, ascoltare, provare, contare o misurare. Non foto da scattare. Basali su quello che hai visto e sul tipo di oggetto: se non sei sicuro che una caratteristica esista su questo pezzo, scrivilo al condizionale invece di darla per presente.',
    ),
  searchQueries: z
    .array(z.string())
    .describe('2-5 query di ricerca, in italiano o inglese, per trovare vendite comparabili'),
});

export type Identification = z.infer<typeof IdentificationSchema>;
