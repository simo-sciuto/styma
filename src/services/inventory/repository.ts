import 'server-only';

import { getServerSupabase } from '@/lib/supabase/server';
import type {
  ComparableRow,
  InventoryEntry,
  ItemDetail,
  ItemImageRow,
  ItemRow,
  ValuationRow,
} from './types';
import { IMAGE_BUCKET } from './types';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function signedUrl(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  path: string,
): Promise<string | null> {
  const { data } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * "Nessun oggetto salvato" e "il database non risponde" sono due frasi
 * diverse, e devono restarlo fino in fondo: un Supabase irraggiungibile
 * (progetto in pausa, rete giu') non deve mai apparire come un inventario
 * vuoto. Chi ha davvero oggetti salvati vedrebbe la pagina dirgli che non
 * c'e' niente, e penserebbe di averli persi.
 */
export type ListInventoryResult =
  | { status: 'ok'; entries: InventoryEntry[] }
  | { status: 'not_configured' }
  | { status: 'unreachable' };

export async function listInventory(): Promise<ListInventoryResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { status: 'not_configured' };

  try {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    // "Nessuna sessione" e "sessione presente ma non verificabile" sono due
    // errori diversi con lo stesso `user: null`: solo il primo e' un utente
    // genuinamente sloggato. Il secondo (rete giu', backend irraggiungibile)
    // e' esattamente il caso che qui non deve travestirsi da inventario vuoto.
    if (authError && authError.name !== 'AuthSessionMissingError') {
      console.error('[inventory] verifica sessione fallita', authError.message);
      return { status: 'unreachable' };
    }
    if (!userData.user) return { status: 'ok', entries: [] };

    const { data: items, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[inventory] lettura oggetti fallita', error.message);
      return { status: 'unreachable' };
    }

    const itemRows = (items ?? []) as ItemRow[];
    if (itemRows.length === 0) return { status: 'ok', entries: [] };

    const ids = itemRows.map((item) => item.id);

    const [{ data: valuations }, { data: images }] = await Promise.all([
      supabase.from('valuations').select('*').in('item_id', ids).order('created_at', { ascending: false }),
      supabase.from('item_images').select('*').in('item_id', ids).order('sort_order'),
    ]);

    const latestValuation = new Map<string, ValuationRow>();
    for (const row of (valuations ?? []) as (ValuationRow & { item_id: string })[]) {
      if (!latestValuation.has(row.item_id)) latestValuation.set(row.item_id, row);
    }

    const cover = new Map<string, string>();
    for (const row of (images ?? []) as (ItemImageRow & { item_id: string })[]) {
      if (!cover.has(row.item_id)) cover.set(row.item_id, row.storage_path);
    }

    const entries = await Promise.all(
      itemRows.map(async (item) => ({
        item,
        valuation: latestValuation.get(item.id) ?? null,
        coverUrl: cover.has(item.id) ? await signedUrl(supabase, cover.get(item.id)!) : null,
      })),
    );

    return { status: 'ok', entries };
  } catch (error) {
    // Un DNS che non risolve, una rete giu': qui la richiesta non arriva
    // nemmeno a Supabase, e supabase-js la fa fallire come eccezione, non
    // come `error` nella risposta. Va presa allo stesso modo.
    console.error('[inventory] Supabase irraggiungibile', error);
    return { status: 'unreachable' };
  }
}

export type GetItemDetailResult =
  | { status: 'ok'; detail: ItemDetail }
  | { status: 'not_configured' }
  | { status: 'unreachable' }
  /** L'oggetto non esiste, o esiste ma non e' di chi lo chiede: la RLS li rende indistinguibili apposta. */
  | { status: 'not_found' };

export async function getItemDetail(id: string): Promise<GetItemDetailResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { status: 'not_configured' };

  try {
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (itemError) {
      console.error('[inventory] lettura oggetto fallita', itemError.message);
      return { status: 'unreachable' };
    }
    if (!item) return { status: 'not_found' };

    const { data: valuations } = await supabase
      .from('valuations')
      .select('*')
      .eq('item_id', id)
      .order('created_at', { ascending: false })
      .limit(1);

    const valuation = ((valuations ?? []) as ValuationRow[])[0] ?? null;

    const [{ data: comparables }, { data: images }] = await Promise.all([
      valuation
        ? supabase
            .from('comparables')
            .select('*')
            .eq('valuation_id', valuation.id)
            .order('used', { ascending: false })
            .order('similarity_score', { ascending: false })
        : Promise.resolve({ data: [] as ComparableRow[] }),
      supabase.from('item_images').select('*').eq('item_id', id).order('sort_order'),
    ]);

    const imageUrls = (
      await Promise.all(
        ((images ?? []) as ItemImageRow[]).map((image) => signedUrl(supabase, image.storage_path)),
      )
    ).filter((url): url is string => url !== null);

    return {
      status: 'ok',
      detail: {
        item: item as ItemRow,
        valuation,
        comparables: (comparables ?? []) as ComparableRow[],
        imageUrls,
      },
    };
  } catch (error) {
    console.error('[inventory] Supabase irraggiungibile', error);
    return { status: 'unreachable' };
  }
}
