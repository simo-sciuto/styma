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

/** Null quando la persistenza non e' configurata o l'utente non ha una sessione. */
export async function listInventory(): Promise<InventoryEntry[] | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data: items, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !items) return [];

  const itemRows = items as ItemRow[];
  if (itemRows.length === 0) return [];

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

  return Promise.all(
    itemRows.map(async (item) => ({
      item,
      valuation: latestValuation.get(item.id) ?? null,
      coverUrl: cover.has(item.id) ? await signedUrl(supabase, cover.get(item.id)!) : null,
    })),
  );
}

export async function getItemDetail(id: string): Promise<ItemDetail | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const { data: item } = await supabase.from('items').select('*').eq('id', id).maybeSingle();
  if (!item) return null;

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
    item: item as ItemRow,
    valuation,
    comparables: (comparables ?? []) as ComparableRow[],
    imageUrls,
  };
}
