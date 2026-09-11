import * as z from 'zod/v4';
import { ConditionSchema } from './identification';

export const CURRENCIES = ['EUR', 'USD', 'GBP'] as const;
export const CurrencySchema = z.enum(CURRENCIES);
export type Currency = z.infer<typeof CurrencySchema>;

/**
 * Quanto un comparabile assomiglia all'oggetto. Determina il peso in valutazione.
 */
export const MATCH_LEVELS = [
  'exact_model',
  'same_family',
  'same_brand',
  'similar_category',
] as const;
export const MatchLevelSchema = z.enum(MATCH_LEVELS);
export type MatchLevel = z.infer<typeof MatchLevelSchema>;

/**
 * Che cosa e' il numero che stiamo guardando.
 *
 * `sold` = una vendita conclusa. `asking` = quanto chiede un venditore, che sia
 * un prezzo fisso o la base d'asta di un'asta senza offerte. `bid` = l'offerta
 * piu' alta su un'asta ancora aperta: soldi che qualcuno ha davvero impegnato,
 * ma su una gara che non e' finita.
 *
 * I tre non vanno mai mescolati. Un prezzo richiesto non e' una vendita, e
 * un'offerta a meta' corsa nemmeno: misurate su 446 aste reali, le offerte in
 * corso stanno fra il 12% e il 71% della mediana dei prezzi fissi dello stesso
 * oggetto, senza convergere neanche nelle ultime due ore. Non c'e' un fattore
 * di correzione: c'e' solo un pavimento. Vedi `services/valuation/comparables.ts`.
 */
export const PRICE_KINDS = ['sold', 'asking', 'bid'] as const;
export const PriceKindSchema = z.enum(PRICE_KINDS);
export type PriceKind = z.infer<typeof PriceKindSchema>;

export const ComparableSchema = z.object({
  title: z.string().describe('Titolo dell’annuncio o della vendita'),
  source: z.string().describe('Piattaforma o casa d’aste, es. "eBay", "Catawiki", "Subito"'),
  url: z.string().describe('URL della pagina trovata'),
  price: z.number().describe('Prezzo numerico, senza simbolo di valuta'),
  currency: CurrencySchema,
  kind: PriceKindSchema.describe(
    'sold solo se la pagina conferma una vendita conclusa; bid se e’ un’asta ancora aperta con almeno un’offerta; asking in tutti gli altri casi',
  ),
  soldAt: z
    .string()
    .nullable()
    .describe('Data della vendita in formato YYYY-MM-DD, null se non indicata'),
  condition: ConditionSchema.describe('Stato dichiarato del comparabile'),
  matchLevel: MatchLevelSchema.describe('Quanto e’ vicino all’oggetto analizzato'),
  notes: z.string().describe('Perché e’ o non e’ un buon comparabile'),
  /**
   * La foto dell'inserzione. Arriva solo dalle fonti strutturate: eBay la
   * restituisce su ogni inserzione (misurato: 20 su 20) e finora la
   * buttavamo via.
   *
   * E' facoltativa e resta fuori dallo schema che vede il modello — vedi
   * `modelFacing` qui sotto. Un comparabile e' credibile per il prezzo e il
   * titolo, non per l'immagine, e chiedere al modello di trovarne una
   * vorrebbe dire invitarlo a inventare un URL.
   */
  imageUrl: z.string().nullable().optional(),
  /**
   * Da dove spedisce chi vende. Presente su 100 inserzioni su 100 (misurato
   * sui cinque mercati), e sono nove paesi, non cinque: interrogando eBay IT,
   * DE, GB, ES e FR rispondono anche venditori giapponesi, olandesi, danesi e
   * austriaci. Serve a dire quanto lontano sta un'occasione.
   */
  country: z.string().nullable().optional(),
  /**
   * Quanto costa farselo mandare **in Italia**, e solo quando lo sappiamo
   * davvero: eBay dichiara la spedizione verso il paese del mercato che stai
   * interrogando, quindi su un'inserzione trovata su eBay.de quella cifra e'
   * il costo per un tedesco. Si valorizza solo dal mercato italiano, dove la
   * domanda e la risposta coincidono; altrove resta null e la pagina lo dice,
   * invece di sommare un numero che parla di un altro destinatario.
   */
  shippingToItalyEur: z.number().nullable().optional(),
  /**
   * Quanto e' affidabile chi vende, secondo i suoi compratori. Presente su
   * tutte le inserzioni eBay. Non entra in nessun calcolo e non deve: e' una
   * cosa da guardare prima di comprare da uno sconosciuto, non un ingrediente
   * della stima.
   */
  sellerRating: z.number().nullable().optional(),
  /** Su quanti voti. Un 100% su tre voti non e' un 100% su quattromila. */
  sellerVotes: z.number().nullable().optional(),
});

export type Comparable = z.infer<typeof ComparableSchema>;

export const MarketResearchSchema = z.object({
  comparables: z.array(ComparableSchema).describe('Comparabili realmente trovati. Vuoto se non ne esistono.'),
  demand: z.enum(['high', 'medium', 'low', 'unknown']).describe('Domanda di mercato osservata'),
  liquidity: z
    .enum(['fast', 'average', 'slow', 'unknown'])
    .describe('Facilita’ di rivendita: quanto in fretta si vende questo tipo di oggetto'),
  notes: z.array(z.string()).describe('Osservazioni sul mercato utili a chi rivende'),
});

export type MarketResearch = z.infer<typeof MarketResearchSchema>;

/**
 * Lo stesso schema, ma senza i campi che il modello non deve compilare.
 *
 * Ogni campo aggiunto allo schema che il modello vede non si paga in token,
 * si paga in attenzione — attenzione tolta a marca e modello, da cui dipende
 * tutto il resto (un'identificazione sbagliata non degrada la stima, la
 * sostituisce senza dirlo). `imageUrl` lo riempiono le fonti strutturate,
 * quindi al modello non lo si chiede; e se non glielo si chiede, non glielo
 * si nomina nemmeno.
 *
 * Questo e' lo schema da passare al modello. `MarketResearchSchema` resta
 * quello con cui l'applicazione legge e valida tutto il resto.
 */
const CAMPI_DALLE_FONTI = {
  imageUrl: true,
  country: true,
  shippingToItalyEur: true,
  sellerRating: true,
  sellerVotes: true,
} as const;

export const ModelMarketResearchSchema = MarketResearchSchema.extend({
  comparables: z
    .array(ComparableSchema.omit(CAMPI_DALLE_FONTI))
    .describe('Comparabili realmente trovati. Vuoto se non ne esistono.'),
});
