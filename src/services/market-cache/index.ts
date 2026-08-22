import type { Identification } from '@/schemas/identification';
import { MarketResearchSchema, type MarketResearch } from '@/schemas/market';
import { getServiceSupabase } from '@/lib/supabase/service';
import { ageInDays, decideCacheability, expiryFor, worthStoring } from './policy';

const TABLE = 'market_research_cache';

export type CachedResearch = {
  research: MarketResearch;
  researchedAt: string;
  ageDays: number;
};

type Row = {
  research: unknown;
  researched_at: string;
  hit_count: number;
};

/**
 * Cerca una ricerca ancora valida per questo oggetto.
 *
 * Ogni errore qui e' silenzioso e vale come "non trovato": la cache e' un
 * risparmio, non una dipendenza. Se Supabase non risponde si paga la ricerca
 * e l'utente non se ne accorge.
 */
export async function readCachedResearch(
  identification: Identification,
): Promise<CachedResearch | null> {
  const decision = decideCacheability(identification);
  if (!decision.cacheable) return null;

  const supabase = getServiceSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('research, researched_at, hit_count')
      .eq('cache_key', decision.key)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle<Row>();

    if (error || !data) return null;

    // Anche cio' che rileggiamo passa dallo schema: una riga scritta da una
    // versione precedente non deve entrare nell'app solo perche' e' nostra.
    const parsed = MarketResearchSchema.safeParse(data.research);
    if (!parsed.success) {
      console.warn(`[cache] riga "${decision.key}" non conforme allo schema, ignorata`);
      return null;
    }

    void supabase
      .from(TABLE)
      .update({ hit_count: data.hit_count + 1 })
      .eq('cache_key', decision.key)
      .then(undefined, () => undefined);

    const researchedAt = new Date(data.researched_at);
    console.info(
      `[cache] riuso "${decision.key}" — ricerca di ${ageInDays(researchedAt)} giorni fa, ${parsed.data.comparables.length} comparabili`,
    );

    return {
      research: parsed.data,
      researchedAt: data.researched_at,
      ageDays: ageInDays(researchedAt),
    };
  } catch (error) {
    console.warn('[cache] lettura fallita, si procede con una ricerca nuova', error);
    return null;
  }
}

/** Archivia una ricerca appena fatta. Silenziosa sugli errori, come la lettura. */
export async function writeCachedResearch(
  identification: Identification,
  research: MarketResearch,
): Promise<void> {
  const decision = decideCacheability(identification);
  if (!decision.cacheable || !worthStoring(research)) return;

  const supabase = getServiceSupabase();
  if (!supabase) return;

  try {
    const now = new Date();
    const { error } = await supabase.from(TABLE).upsert(
      {
        cache_key: decision.key,
        research,
        market_pace: identification.marketPace,
        comparable_count: research.comparables.length,
        researched_at: now.toISOString(),
        expires_at: expiryFor(identification.marketPace, now).toISOString(),
        hit_count: 0,
      },
      { onConflict: 'cache_key' },
    );

    if (error) {
      console.warn('[cache] scrittura fallita', error.message);
      return;
    }
    console.info(
      `[cache] archiviata "${decision.key}" — valida ${identification.marketPace}, scade il ${expiryFor(identification.marketPace, now).toLocaleDateString('it-IT')}`,
    );
  } catch (error) {
    console.warn('[cache] scrittura fallita', error);
  }
}

export { decideCacheability, CACHE_TTL_DAYS } from './policy';
