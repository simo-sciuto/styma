'use server';

import { revalidatePath } from 'next/cache';

import { getServerSupabase } from '@/lib/supabase/server';
import type { AnalysisResult } from '@/schemas/analysis';
import { OutcomeInputSchema } from '@/schemas/outcome';

export type SaveResult = { ok: true; itemId: string } | { ok: false; error: string };

/**
 * Salva l'analisi cosi' com'e' stata mostrata: fascia, punteggio e i
 * comparabili su cui si reggeva, usati e scartati. Una nuova analisi dello
 * stesso oggetto aggiungera' una valutazione, senza cancellare questa.
 *
 * Il prezzo che arriva qui e' quello *chiesto* dal banco, l'unico che si
 * conosce mentre si guarda l'oggetto. Finiva in `purchase_price` con lo stato
 * "comprato" dedotto dalla sua presenza: l'inventario dichiarava acquisti che
 * nessuno aveva fatto, e il totale "speso" sommava soldi mai usciti. Quanto
 * hai pagato davvero lo dici dopo, quando l'hai comprato davvero.
 */
export async function saveAnalysis(
  result: AnalysisResult,
  askingPrice: number | null,
): Promise<SaveResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: 'Persistenza non configurata.' };

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, error: 'Sessione assente: riprova.' };

  const { identification, valuation, flip, market, marketSource, warnings } = result;

  const { data: item, error: itemError } = await supabase
    .from('items')
    .insert({
      user_id: user.id,
      title: identification.name,
      category: identification.category,
      brand: identification.brand,
      model: identification.model,
      description: identification.history,
      estimated_period: identification.period,
      condition: identification.condition,
      identification_confidence: identification.confidence,
      // Prima si perdevano al salvataggio: chi riapriva l'oggetto, o generava
      // un annuncio da un pezzo gia' salvato, aveva meno da dire di quanto
      // l'analisi avesse davvero visto.
      materials: identification.materials,
      characteristics: identification.characteristics,
      condition_notes: identification.conditionNotes,
      markings: identification.markings,
      asking_price: askingPrice,
      status: 'found',
    })
    .select('id')
    .single();

  if (itemError || !item) {
    return { ok: false, error: 'Non siamo riusciti a salvare l’oggetto.' };
  }

  const itemId = (item as { id: string }).id;

  const { data: valuationRow, error: valuationError } = await supabase
    .from('valuations')
    .insert({
      item_id: itemId,
      currency: 'EUR',
      low_value: valuation.available ? valuation.low : null,
      high_value: valuation.available ? valuation.high : null,
      likely_value: valuation.available ? valuation.likely : null,
      confidence: valuation.available ? valuation.confidence : null,
      confidence_score: valuation.available ? valuation.confidenceScore : null,
      flip_score: flip?.atPrice?.score ?? null,
      recommendation: flip?.atPrice?.recommendation ?? null,
      assessed_at_price: flip?.atPrice?.purchasePrice ?? null,
      // Una valutazione immutabile deve restare leggibile fra un mese: senza
      // questo, la fascia sembrerebbe piu' fresca di quanto fosse.
      market_researched_at: marketSource?.researchedAt ?? null,
      market_research_cached: marketSource?.cached ?? null,
      // Su cosa poggiava la fascia: solo stesso modello, o anche oggetti
      // simili perche' di identici non ce n'erano abbastanza. Riletto fra un
      // mese, chi vede la fascia deve poter capire quanto fidarsene.
      comparable_tier: valuation.available ? valuation.comparableTier : null,
      reasoning: {
        factors: flip?.factors ?? [],
        reasons: valuation.available ? valuation.reasons : [],
        warnings,
        demand: market?.demand,
        liquidity: market?.liquidity,
        unavailableReason: valuation.available ? undefined : valuation.reason,
        thresholds: flip?.thresholds,
      },
    })
    .select('id')
    .single();

  if (valuationError || !valuationRow) {
    return { ok: false, error: 'Oggetto salvato, ma la valutazione non e’ stata registrata.' };
  }

  const valuationId = (valuationRow as { id: string }).id;

  const comparableRows = [
    ...(valuation.available ? valuation.used : []).map((entry) => ({
      valuation_id: valuationId,
      title: entry.comparable.title,
      source: entry.comparable.source,
      url: entry.comparable.url,
      price: entry.comparable.price,
      currency: entry.comparable.currency,
      kind: entry.comparable.kind,
      sold_at: entry.comparable.soldAt,
      condition: entry.comparable.condition,
      match_level: entry.comparable.matchLevel,
      similarity_score: entry.weight,
      used: true,
      discard_reason: null,
      notes: entry.comparable.notes,
    })),
    ...valuation.discarded.map(({ comparable, reason }) => ({
      valuation_id: valuationId,
      title: comparable.title,
      source: comparable.source,
      url: comparable.url,
      price: comparable.price,
      currency: comparable.currency,
      kind: comparable.kind,
      sold_at: comparable.soldAt,
      condition: comparable.condition,
      match_level: comparable.matchLevel,
      similarity_score: null,
      used: false,
      discard_reason: reason,
      notes: comparable.notes,
    })),
  ];

  if (comparableRows.length > 0) {
    await supabase.from('comparables').insert(comparableRows);
  }

  revalidatePath('/inventario');
  return { ok: true, itemId };
}

export type OutcomeResult = { ok: true } | { ok: false; error: string };

/**
 * Registra com'e' finita: comprato, lasciato perdere, messo in vendita,
 * venduto.
 *
 * Ogni transizione scrive solo i campi che quel passaggio conosce davvero.
 * Non si deduce niente: un oggetto venduto senza data di acquisto resta
 * senza giorni di possesso, e l'interfaccia lo dira', invece di stimarli.
 *
 * La proprieta' non si verifica qui: la RLS lascia aggiornare solo le righe
 * di chi chiede, e una riga altrui semplicemente non viene toccata. Per
 * questo l'update chiede indietro l'id — zero righe e' l'unico modo di
 * accorgersene.
 */
export async function recordOutcome(itemId: string, raw: unknown): Promise<OutcomeResult> {
  const parsed = OutcomeInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Dati non validi.' };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: 'Persistenza non configurata.' };

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sessione assente: riprova.' };

  const input = parsed.data;
  const patch: Record<string, unknown> = (() => {
    switch (input.type) {
      case 'bought':
        return {
          status: 'bought',
          purchase_price: input.price,
          purchase_date: input.date,
          purchase_location: input.location,
        };
      case 'passed':
        // Il prezzo pagato si azzera apposta: se avevi segnato l'acquisto e
        // poi correggi, lasciare la cifra la' vorrebbe dire contare fra le
        // spese un oggetto che hai lasciato al banco.
        return {
          status: 'passed',
          purchase_price: null,
          purchase_date: null,
          purchase_location: null,
        };
      case 'listed':
        return { status: 'listed', listed_at: input.date, marketplace: input.marketplace };
      case 'sold':
        return {
          status: 'sold',
          sale_price: input.price,
          sale_date: input.date,
          marketplace: input.marketplace,
        };
      case 'reopen':
        return {
          status: 'found',
          purchase_price: null,
          purchase_date: null,
          purchase_location: null,
          listed_at: null,
          sale_price: null,
          sale_date: null,
        };
    }
  })();

  const { data, error } = await supabase.from('items').update(patch).eq('id', itemId).select('id');

  if (error) {
    console.error('[inventory] esito non registrato', error.message);
    return { ok: false, error: 'Non siamo riusciti a registrare l’esito.' };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Oggetto non trovato.' };
  }

  revalidatePath('/inventario');
  revalidatePath(`/inventario/${itemId}`);
  return { ok: true };
}

export async function registerImages(
  itemId: string,
  paths: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: 'Persistenza non configurata.' };
  if (paths.length === 0) return { ok: true };

  const { error } = await supabase
    .from('item_images')
    .insert(paths.map((storage_path, sort_order) => ({ item_id: itemId, storage_path, sort_order })));

  if (error) return { ok: false, error: 'Le foto non sono state collegate all’oggetto.' };

  revalidatePath('/inventario');
  revalidatePath(`/inventario/${itemId}`);
  return { ok: true };
}
