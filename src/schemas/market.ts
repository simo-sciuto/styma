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
