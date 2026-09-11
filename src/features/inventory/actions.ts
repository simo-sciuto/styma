'use server';

import { revalidatePath } from 'next/cache';

import { findPreviousSightings, type PreviousSighting } from '@/services/inventory/repository';

import { getServerSupabase } from '@/lib/supabase/server';
import { downloadListingImages } from '@/services/listings';
import { IMAGE_BUCKET } from '@/services/inventory/types';
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
      // Cosa reggeva l'attribuzione quel giorno. Riaprire l'oggetto fra sei
      // mesi e trovare solo "Vitra" scritto nel titolo, senza sapere che
      // sotto la seduta non c'era nessun marchio, sarebbe una promozione
      // silenziosa da ipotesi a fatto.
      authenticity: identification.authenticity,
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
      // L'analisi intera, per poterla rivedere identica invece che ridotta a
      // una scheda. Il verdetto non entra: e' funzione del prezzo che si sta
      // digitando, e si ricalcola.
      snapshot: { identification, market, marketSource, valuation, warnings },
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
 * «L'hai gia' visto». Chiamata dal client appena l'identificazione arriva,
 * cioe' molto prima che la stima sia pronta: e' l'informazione piu' utile del
 * momento, e non deve aspettare il resto.
 */
export async function lookUpPreviousSightings(
  brand: string | null,
  model: string | null,
  excludeItemId: string | null = null,
): Promise<PreviousSighting[]> {
  return findPreviousSightings(brand, model, excludeItemId);
}

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
        // spese un oggetto che hai lasciato al banco. Vale anche per quello
        // che ci avevi speso sopra.
        return {
          status: 'passed',
          purchase_price: null,
          purchase_date: null,
          purchase_location: null,
          extra_costs: null,
          extra_costs_note: null,
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
      case 'costs':
        // Non tocca lo stato: si dichiarano mentre l'oggetto e' in casa o dopo
        // averlo venduto, e in nessuno dei due casi cambiano dove si trova.
        return { extra_costs: input.amount, extra_costs_note: input.note };
      case 'reopen':
        return {
          status: 'found',
          purchase_price: null,
          purchase_date: null,
          purchase_location: null,
          listed_at: null,
          sale_price: null,
          sale_date: null,
          // I costi seguono l'acquisto: senza un acquisto non appartengono a
          // niente, e il vincolo in migrazione lo impone comunque.
          extra_costs: null,
          extra_costs_note: null,
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

/**
 * Il prezzo del banco, aggiornato mentre lo digiti.
 *
 * L'analisi si salva da sola appena finisce, cioe' prima che tu abbia scritto
 * quanto te lo chiedono: senza questo, l'unico numero che rende il verdetto
 * utile non arriverebbe mai nel database, e riaprendo l'oggetto domani il
 * campo sarebbe vuoto.
 */
export async function setAskingPrice(itemId: string, price: number | null): Promise<OutcomeResult> {
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1_000_000)) {
    return { ok: false, error: 'Prezzo non valido.' };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: 'Persistenza non configurata.' };

  // Come in `recordOutcome`: la RLS non fa fallire un update su una riga
  // altrui, la lascia semplicemente fuori. Senza chiedere indietro l'id, zero
  // righe aggiornate sarebbero indistinguibili da un successo.
  const { data, error } = await supabase
    .from('items')
    .update({ asking_price: price })
    .eq('id', itemId)
    .select('id');

  if (error) {
    console.error('[inventory] prezzo richiesto non aggiornato', error.message);
    return { ok: false, error: 'Prezzo non registrato.' };
  }
  if (!data || data.length === 0) {
    console.error('[inventory] prezzo richiesto: nessuna riga aggiornata', itemId);
    return { ok: false, error: 'Oggetto non trovato.' };
  }
  return { ok: true };
}

/**
 * Fuori dalla lista, dentro i dati.
 *
 * Ogni analisi diventa un oggetto salvato, quindi l'inventario raccoglie
 * anche quello che hai solo guardato di sfuggita. Archiviare toglie di mezzo
 * senza cancellare: un oggetto scartato e' il dato che dice se un «lascia
 * stare» era giusto, e buttarlo per fare ordine sarebbe buttare la meta' piu'
 * difficile da raccogliere.
 */
export async function setArchived(itemId: string, archived: boolean): Promise<OutcomeResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: 'Persistenza non configurata.' };

  const { data, error } = await supabase
    .from('items')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', itemId)
    .select('id');

  if (error) {
    console.error('[inventory] archiviazione fallita', error.message);
    return { ok: false, error: 'Non siamo riusciti ad archiviarlo.' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'Oggetto non trovato.' };

  revalidatePath('/inventario');
  revalidatePath(`/inventario/${itemId}`);
  return { ok: true };
}

/**
 * Le foto di un annuncio, portate dentro il nostro magazzino.
 *
 * Un'analisi nata da un link non passa da nessun file scelto a mano, quindi
 * senza questo l'oggetto salvato resterebbe **senza foto dappertutto**: niente
 * copertina in lista, niente immagine grande nella scheda, niente miniatura
 * sul risultato riaperto. Il difetto non si vedeva subito, perche' il
 * risultato appena fatto mostrava comunque le foto dell'annuncio dal vivo: si
 * sarebbe visto domani, con l'inventario pieno di rettangoli grigi.
 *
 * Le foto si **copiano**, non si linkano. Un annuncio venduto sparisce, e con
 * lui le sue immagini: un inventario che punta a URL di Vinted e' un
 * inventario che si svuota da solo. Quello che teniamo deve essere nostro,
 * come per una foto scattata al banco.
 *
 * Una foto che non si scarica non ferma le altre, e zero foto non fanno
 * fallire il salvataggio: l'analisi vale comunque piu' delle sue immagini.
 */
export async function importListingImages(
  itemId: string,
  urls: string[],
): Promise<{ ok: boolean; imported: number }> {
  if (urls.length === 0) return { ok: true, imported: 0 };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, imported: 0 };

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ok: false, imported: 0 };

  const scaricate = await downloadListingImages(urls).catch((caught: unknown) => {
    console.error('[inventory] foto dell’annuncio non scaricate', caught);
    return [];
  });
  if (scaricate.length === 0) return { ok: false, imported: 0 };

  const paths: string[] = [];
  for (const [index, image] of scaricate.entries()) {
    const estensione =
      image.mediaType === 'image/png' ? 'png' : image.mediaType === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/${itemId}/${String(index).padStart(2, '0')}.${estensione}`;
    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, Buffer.from(image.data, 'base64'), {
        contentType: image.mediaType,
        upsert: true,
      });
    // Un caricamento fallito lascia una riga: un inventario senza foto e
    // nessun log e' un vicolo cieco, ed e' gia' costato abbastanza qui.
    if (error) console.error(`[inventory] foto non caricata (${path})`, error.message);
    else paths.push(path);
  }

  console.info(`[inventory] annuncio ${itemId}: ${paths.length}/${scaricate.length} foto importate`);
  await registerImages(itemId, paths);
  return { ok: paths.length > 0, imported: paths.length };
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
