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
 * `sold` = prezzo di vendita confermato. `asking` = prezzo richiesto in un annuncio.
 * Non vanno mai mescolati senza distinzione: un prezzo richiesto non e' una vendita.
 */
export const PRICE_KINDS = ['sold', 'asking'] as const;
export const PriceKindSchema = z.enum(PRICE_KINDS);
export type PriceKind = z.infer<typeof PriceKindSchema>;

export const ComparableSchema = z.object({
  title: z.string().describe('Titolo dell’annuncio o della vendita'),
  source: z.string().describe('Piattaforma o casa d’aste, es. "eBay", "Catawiki", "Subito"'),
  url: z.string().describe('URL della pagina trovata'),
  price: z.number().describe('Prezzo numerico, senza simbolo di valuta'),
  currency: CurrencySchema,
  kind: PriceKindSchema.describe('sold solo se la pagina conferma una vendita conclusa'),
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
