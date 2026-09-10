import * as z from 'zod/v4';

import { IdentificationSchema } from './identification';
import { ComparableSchema, MarketResearchSchema } from './market';
import type { AnalysisResult } from './analysis';

/**
 * L'analisi come e' stata mostrata, per poterla rimostrare identica.
 *
 * Fino a qui un'analisi viveva nello stato di React: bastava ricaricare la
 * pagina per perderla, e il salvataggio in inventario conservava una versione
 * ridotta — abbastanza per una scheda, non per rivedere la pagina che aveva
 * portato alla decisione. Qui si conserva tutto quello che serve a ricostruirla.
 *
 * Torna dal database, quindi passa da uno schema come tutto il resto: fra sei
 * mesi il codice sara' cambiato e il JSON no, e la differenza va vista subito
 * invece di diventare un errore in pagina.
 *
 * `flip` non c'e' apposta. E' una funzione del prezzo che stai digitando ora,
 * non un dato di ieri: si ricalcola con `assessFlip` da valutazione e
 * identificazione, che sono qui dentro. Congelarlo vorrebbe dire mostrare il
 * verdetto di un prezzo che nessuno sta piu' guardando.
 */

const WeightedComparableSchema = z.object({
  comparable: ComparableSchema,
  priceEur: z.number(),
  weight: z.number(),
  weightBreakdown: z.object({ match: z.number(), condition: z.number() }),
});

const DiscardedSchema = z.object({ comparable: ComparableSchema, reason: z.string() });

const ValuationSchema = z.discriminatedUnion('available', [
  z.object({
    available: z.literal(true),
    currency: z.literal('EUR'),
    low: z.number(),
    likely: z.number(),
    high: z.number(),
    confidence: z.enum(['high', 'medium', 'low']),
    confidenceScore: z.number(),
    used: z.array(WeightedComparableSchema),
    discarded: z.array(DiscardedSchema),
    strongCount: z.number(),
    identicalCount: z.number(),
    comparableTier: z.enum(['identical', 'similar', 'weak']),
    dispersion: z.number(),
    reasons: z.array(z.string()),
  }),
  z.object({
    available: z.literal(false),
    reason: z.string(),
    discarded: z.array(DiscardedSchema),
    observed: z
      .object({ count: z.number(), lowEur: z.number(), highEur: z.number() })
      .nullable(),
  }),
]);

export const AnalysisSnapshotSchema = z.object({
  identification: IdentificationSchema,
  market: MarketResearchSchema.nullable(),
  marketSource: z
    .object({ cached: z.boolean(), researchedAt: z.string(), ageDays: z.number() })
    .nullable(),
  valuation: ValuationSchema,
  warnings: z.array(z.string()),
});

export type AnalysisSnapshot = z.infer<typeof AnalysisSnapshotSchema>;

/**
 * Il compilatore verifica che lo schema copra davvero l'analisi.
 *
 * Servono due controlli, non uno. Il primo tiene compatibili i tipi dei campi
 * in comune. Il secondo e' quello che conta di piu': TypeScript accetta senza
 * lamentarsi un oggetto con campi in piu', quindi un campo aggiunto a
 * `AnalysisResult` e dimenticato qui passerebbe inosservato — e un'analisi
 * salvata perderebbe un pezzo in silenzio, che e' il modo peggiore di
 * perderlo. Confrontare gli insiemi di chiavi lo fa fallire in compilazione.
 */
const _tipiCompatibili: AnalysisSnapshot = null as unknown as Omit<AnalysisResult, 'flip'>;
void _tipiCompatibili;

type ChiaviMancanti = Exclude<keyof Omit<AnalysisResult, 'flip'>, keyof AnalysisSnapshot>;
const _nessunaChiaveMancante: [ChiaviMancanti] extends [never] ? true : ChiaviMancanti = true;
void _nessunaChiaveMancante;
