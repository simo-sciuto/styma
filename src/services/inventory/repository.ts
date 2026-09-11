import 'server-only';

import { getServerSupabase } from '@/lib/supabase/server';
import { AnalysisSnapshotSchema, type AnalysisSnapshot } from '@/schemas/snapshot';
import type {
  ComparableRow,
  InventoryEntry,
  ItemDetail,
  ItemImageRow,
  ItemRow,
  ItemStatus,
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
  | { status: 'ok'; entries: InventoryEntry[]; archived: number }
  | { status: 'not_configured' }
  | { status: 'unreachable' };

/**
 * Gli archiviati restano fuori dalla lista ma dentro i conti di quanti sono:
 * nasconderli senza dire quanti sono farebbe sparire oggetti senza che
 * nessuno sappia dove sono finiti.
 */
export async function listInventory(includeArchived = false): Promise<ListInventoryResult> {
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
    if (!userData.user) return { status: 'ok', entries: [], archived: 0 };

    const { data: items, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[inventory] lettura oggetti fallita', error.message);
      return { status: 'unreachable' };
    }

    const allRows = (items ?? []) as ItemRow[];
    const archived = allRows.filter((item) => item.archived_at !== null).length;
    const itemRows = includeArchived
      ? allRows
      : allRows.filter((item) => item.archived_at === null);
    if (itemRows.length === 0) return { status: 'ok', entries: [], archived };

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

    return { status: 'ok', entries, archived };
  } catch (error) {
    // Un DNS che non risolve, una rete giu': qui la richiesta non arriva
    // nemmeno a Supabase, e supabase-js la fa fallire come eccezione, non
    // come `error` nella risposta. Va presa allo stesso modo.
    console.error('[inventory] Supabase irraggiungibile', error);
    return { status: 'unreachable' };
  }
}

/**
 * L'analisi salvata, riletta.
 *
 * Passa dallo schema come qualunque altro dato esterno: il JSON e' stato
 * scritto da una versione del codice che non e' piu' questa, e un campo
 * mancante deve diventare "non ho lo snapshot" — cioe' la scheda ridotta,
 * che c'e' sempre — invece di un errore in pagina o, peggio, di una pagina
 * incompleta che sembra completa.
 *
 * Gli oggetti salvati prima di questa versione non ce l'hanno affatto, ed e'
 * lo stesso caso.
 */
function readSnapshot(valuation: ValuationRow | null): AnalysisSnapshot | null {
  if (!valuation?.snapshot) return null;
  const parsed = AnalysisSnapshotSchema.safeParse(valuation.snapshot);
  if (!parsed.success) {
    console.warn('[inventory] snapshot non rileggibile', parsed.error.issues[0]?.message);
    return null;
  }
  return parsed.data;
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
        snapshot: readSnapshot(valuation),
        comparables: (comparables ?? []) as ComparableRow[],
        imageUrls,
      },
    };
  } catch (error) {
    console.error('[inventory] Supabase irraggiungibile', error);
    return { status: 'unreachable' };
  }
}

/**
 * Lo stesso oggetto, gia' analizzato in passato.
 *
 * Al mercato la stessa Olivetti Valentine ricapita sei volte a stagione, e
 * fino a ieri l'app non se ne accorgeva: rifaceva l'analisi da zero, ripagava
 * l'identificazione e mostrava una fascia come se fosse la prima volta. Ma
 * l'informazione piu' utile in quel momento non e' la stima: e' che tre
 * settimane fa l'avevi gia' visto, l'avevi lasciato a 40 € e adesso te ne
 * chiedono 60.
 *
 * Il confronto e' su marca e modello normalizzati, non sul titolo: «Olivetti
 * Valentine» e «Macchina da scrivere Olivetti Valentine rossa» sono lo stesso
 * oggetto e due titoli diversi. Senza modello non si cerca: la sola marca
 * pescherebbe qualunque altra cosa dello stesso produttore, che e' lo stesso
 * errore che `mentionsObjectType` evita sui comparabili.
 */
export type PreviousSighting = {
  id: string;
  seenAt: string;
  status: ItemStatus;
  askingPrice: number | null;
  purchasePrice: number | null;
  salePrice: number | null;
};

export async function findPreviousSightings(
  brand: string | null,
  model: string | null,
  excludeItemId: string | null = null,
): Promise<PreviousSighting[]> {
  if (!brand || !model) return [];

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('items')
      .select('id, created_at, status, asking_price, purchase_price, sale_price, brand, model')
      .ilike('brand', brand)
      .ilike('model', model)
      .order('created_at', { ascending: false })
      .limit(4);

    if (error) {
      console.error('[inventory] ricerca dei precedenti fallita', error.message);
      return [];
    }

    return (data ?? [])
      .filter((row) => row.id !== excludeItemId)
      .slice(0, 3)
      .map((row) => ({
        id: row.id as string,
        seenAt: row.created_at as string,
        status: row.status as ItemStatus,
        askingPrice: row.asking_price as number | null,
        purchasePrice: row.purchase_price as number | null,
        salePrice: row.sale_price as number | null,
      }));
  } catch (caught) {
    console.error('[inventory] ricerca dei precedenti interrotta', caught);
    return [];
  }
}
