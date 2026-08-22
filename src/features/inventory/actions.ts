'use server';

import { revalidatePath } from 'next/cache';

import { getServerSupabase } from '@/lib/supabase/server';
import type { AnalysisResult } from '@/schemas/analysis';

export type SaveResult = { ok: true; itemId: string } | { ok: false; error: string };

/**
 * Salva l'analisi cosi' com'e' stata mostrata: forbice, punteggio e i
 * comparabili su cui si reggeva, usati e scartati. Una nuova analisi dello
 * stesso oggetto aggiungera' una valutazione, senza cancellare questa.
 */
export async function saveAnalysis(
  result: AnalysisResult,
  purchasePrice: number | null,
): Promise<SaveResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: 'Persistenza non configurata.' };

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, error: 'Sessione assente: riprova.' };

  const { identification, valuation, flip, market, warnings } = result;

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
      purchase_price: purchasePrice,
      status: purchasePrice === null ? 'found' : 'bought',
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
