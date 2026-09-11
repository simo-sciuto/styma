'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Button, Card, PageHeader } from '@/components/ui';
import { readAnalysisEvents, type ListingEvent } from '@/lib/analysis-stream';
import { assessFlip } from '@/services/valuation/flip-score';
import type { PreparedImage } from '@/lib/images';
import type { AnalysisResult } from '@/schemas/analysis';
import type { AnalysisSnapshot } from '@/schemas/snapshot';
import type { Identification } from '@/schemas/identification';
import { NOTHING_YET, type PartialIdentification } from '@/services/ai/partial';
import { ArchiveToggle } from '@/features/inventory/ArchiveToggle';
import { AutoSave } from '@/features/inventory/AutoSave';
import { LinkAccountNudge } from '@/features/auth/LinkAccountNudge';
import { lookUpPreviousSightings } from '@/features/inventory/actions';
import { usePersistAskingPrice } from '@/features/inventory/useAskingPrice';
import type { PreviousSighting } from '@/services/inventory/repository';
import type { SharedListing } from '@/services/listings/types';
import type { Calibration } from '@/services/inventory/calibration';
import { AnalysisProgress, type Passo } from './AnalysisProgress';
import { ListingCard } from './ListingCard';
import { ListingInput } from './ListingInput';
import { PhotoPicker } from './PhotoPicker';
import { ResultView } from './ResultView';

type Stage = 'idle' | 'identifying' | 'researching' | 'done';

/**
 * Un'analisi gia' salvata, passata dal server quando l'indirizzo porta un
 * `?oggetto=`. Il verdetto non c'e' e non deve esserci: e' funzione del
 * prezzo che stai digitando adesso, e si ricalcola qui con `assessFlip`.
 */
export type SavedAnalysis = {
  itemId: string;
  snapshot: AnalysisSnapshot;
  coverUrl: string | null;
  askingPrice: number | null;
};

/**
 * Una corsia di ricerca vista da chi aspetta. Lo stato arriva dal server
 * quando la corsia finisce davvero: nessuna barra che avanza da sola.
 */
type LaneProgress = {
  id: string;
  label: string;
  status: 'running' | 'done' | 'failed';
  comparables: number;
};

function parsePurchasePrice(raw: string): number | null {
  if (raw.trim() === '') return null;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function AnalyzeFlow({
  saved = null,
  calibration = null,
}: {
  saved?: SavedAnalysis | null;
  /** Letta dal server al caricamento: non cambia durante l'analisi. */
  calibration?: Calibration | null;
}) {
  // Il prezzo gia' registrato per questo oggetto. Serve anche dopo, come
  // valore di riferimento del salvataggio ritardato: senza, il primo effetto
  // riscriverebbe `null` sopra la cifra appena riletta dal database.
  const prezzoSalvato = saved?.askingPrice != null ? String(saved.askingPrice) : '';

  const [images, setImages] = useState<PreparedImage[]>([]);
  const [purchasePrice, setPurchasePrice] = useState(prezzoSalvato);
  const [stage, setStage] = useState<Stage>(saved ? 'done' : 'idle');
  const [identification, setIdentification] = useState<Identification | null>(
    saved?.snapshot.identification ?? null,
  );
  const [result, setResult] = useState<AnalysisResult | null>(
    saved ? { ...saved.snapshot, flip: null } : null,
  );
  const [lanes, setLanes] = useState<LaneProgress[]>([]);
  const [reusedResearch, setReusedResearch] = useState<{ ageDays: number; comparables: number } | null>(
    null,
  );
  const [structuredSource, setStructuredSource] = useState<{
    label: string;
    comparables: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Quel poco che si sa mentre il modello sta ancora scrivendo: nome, tipo,
   * marca, modello. Vale solo durante l'attesa, e viene sostituito
   * dall'identificazione vera appena arriva.
   */
  const [partial, setPartial] = useState<PartialIdentification>(NOTHING_YET);
  /**
   * L'annuncio da cui siamo partiti, quando si parte da un link. Resta in
   * pagina accanto al risultato: quello che dice chi vende e quello che
   * vediamo noi sono due cose, e vanno lette come due cose.
   */
  const [listing, setListing] = useState<SharedListing | null>(null);
  /**
   * Lo stesso modello, gia' passato per le nostre mani. Tiene con se' la
   * chiave per cui e' stato cercato: cosi' un risultato che arriva in ritardo
   * per l'oggetto di prima non si mostra sotto quello di adesso, e non serve
   * azzerare lo stato dentro l'effetto.
   */
  const [sightings, setSightings] = useState<{ chiave: string; trovati: PreviousSighting[] }>({
    chiave: '',
    trovati: [],
  });
  /** L'id dell'oggetto salvato: e' l'indirizzo a cui questa analisi vive. */
  const [itemId, setItemId] = useState<string | null>(saved?.itemId ?? null);
  /** Se questa analisi arriva dal database: allora e' gia' salvata, e
   *  rimetterla in salvataggio la duplicherebbe. */
  const [giaSalvata, setGiaSalvata] = useState(saved !== null);

  const busy = stage === 'identifying' || stage === 'researching';

  /**
   * Appena l'oggetto esiste, l'indirizzo della pagina diventa il suo.
   *
   * Cambia il parametro di ricerca e resta su `/analizza`, che e' l'unica
   * forma sicura: in App Router `replaceState` e' agganciato al router, e
   * riscrivere il *percorso* — come si faceva prima, verso `/inventario/<id>`
   * — convinceva il router di stare su un'altra rotta. Alla prima azione
   * server successiva, cioe' al primo carattere del prezzo, rigenerava quella
   * rotta e buttava via il risultato appena arrivato: esattamente il rimonto
   * che questa riga voleva evitare, solo differito di qualche secondo e
   * quindi molto piu' difficile da vedere. Vedi `app/analizza/page.tsx`.
   */
  useEffect(() => {
    if (itemId) window.history.replaceState(null, '', `/analizza?oggetto=${itemId}`);
  }, [itemId]);

  /*
   * I precedenti si chiedono appena c'e' un'identificazione, non a fine
   * analisi: e' l'informazione piu' utile del momento e non ha motivo di
   * aspettare la stima. Rimonta a ogni cambio di marca o modello, e
   * `itemId` esce dall'elenco perche' l'oggetto di adesso non e' un
   * precedente di se stesso.
   */
  const marca = identification?.brand ?? null;
  const modello = identification?.model ?? null;
  const chiaveModello = marca && modello ? `${marca}|${modello}|${itemId ?? ''}` : '';

  useEffect(() => {
    if (chiaveModello === '') return;
    let valido = true;
    const [cercaMarca, cercaModello, escludi] = chiaveModello.split('|');
    void lookUpPreviousSightings(cercaMarca!, cercaModello!, escludi || null).then((trovati) => {
      if (valido) setSightings({ chiave: chiaveModello, trovati });
    });
    return () => {
      valido = false;
    };
  }, [chiaveModello]);

  const precedenti = sightings.chiave === chiaveModello ? sightings.trovati : [];

  // Il prezzo si scrive dopo il salvataggio automatico, quindi va portato
  // all'oggetto man mano che lo digiti. Il valore di riferimento e' quello
  // che sta gia' nel database: vuoto per un'analisi appena fatta, la cifra
  // riletta per una riaperta.
  usePersistAskingPrice(itemId, purchasePrice, prezzoSalvato);

  /**
   * Il verdetto al prezzo digitato, ricalcolato qui invece che sul server.
   * `assessFlip` e' la stessa funzione pura che gira in `/api/valuate`, e
   * lavora solo su dati gia' arrivati: rifare la chiamata a ogni tasto
   * costerebbe secondi di attesa per un conto che dura microsecondi. Il
   * risultato ricalcolato e' anche quello che finisce in inventario, cosi'
   * si salva esattamente il giudizio che si e' visto.
   */
  const liveResult = useMemo(() => {
    if (!result) return null;
    const price = parsePurchasePrice(purchasePrice);
    return {
      ...result,
      flip: assessFlip(result.identification, result.market, result.valuation, price),
    };
  }, [result, purchasePrice]);

  /**
   * I tre passi, ricavati da cio' che e' successo davvero.
   *
   * Nessuno si accende per un timer: il primo chiude quando arriva
   * l'identificazione, il secondo quando una fonte di mercato risponde
   * (eBay o la cache), il terzo quando il risultato e' in mano. Se un giorno
   * la pipeline cambia, questi passi vanno cambiati con lei — altrimenti
   * raccontano un lavoro che non stiamo facendo.
   */
  const mercatoRisposto = structuredSource !== null || reusedResearch !== null;

  /** Il nome piu' preciso che si sappia adesso, anche a identificazione aperta. */
  const nomeParziale =
    [partial.brand, partial.model].filter(Boolean).join(' ') || partial.name || partial.objectType;
  const passi: Passo[] = [
    {
      titolo: 'Riconosco l’oggetto',
      /*
       * Mentre il modello scrive, il passo dice gia' cosa ha in mano invece
       * di raccontare cosa sta facendo: «Olivetti Valentine» comparso al
       * terzo secondo vale piu' di venti secondi di «leggo i marchi».
       */
      durante: nomeParziale ?? 'Leggo forma, materiali, marchi e punzoni.',
      esito: identification ? identification.name : null,
      stato: identification ? 'fatto' : 'corso',
    },
    {
      titolo: 'Cerco sul mercato',
      durante: 'Annunci dello stesso modello su cinque mercati eBay.',
      esito: reusedResearch
        ? `Ricerca gia' fatta ${reusedResearch.ageDays === 0 ? 'oggi' : `${reusedResearch.ageDays} giorni fa`}: riuso ${reusedResearch.comparables} comparabili.`
        : structuredSource
          ? structuredSource.comparables > 0
            ? `${structuredSource.comparables} inserzioni trovate.`
            : 'Nessuna inserzione: cerco altrove.'
          : null,
      stato: mercatoRisposto ? 'fatto' : identification ? 'corso' : 'attesa',
    },
    {
      titolo: 'Faccio i conti',
      durante: 'Peso i comparabili, tolgo quelli fuori scala, calcolo la fascia.',
      esito: null,
      stato: mercatoRisposto ? 'corso' : 'attesa',
    },
  ];

  /** Riparte da zero: e' identico per le due porte d'ingresso. */
  function ricomincia() {
    setError(null);
    setResult(null);
    setIdentification(null);
    setPartial(NOTHING_YET);
    setListing(null);
    setSightings({ chiave: '', trovati: [] });
    setLanes([]);
    setReusedResearch(null);
    setStructuredSource(null);
    setStage('identifying');
  }

  /**
   * L'identificazione, da qualunque porta si entri.
   *
   * Arriva a eventi: i campi in cima allo schema (nome, tipo, marca, modello)
   * sono pronti dopo due o tre secondi, il resto dopo venti. Non accorcia
   * l'attesa di un millisecondo, accorcia il tempo in cui chi guarda non sa
   * ancora niente.
   *
   * Lo stesso lettore vale per `/api/identify` e per `/api/annuncio`: il
   * secondo manda due eventi in piu' davanti, l'annuncio e quante foto e'
   * riuscito a scaricare, e da li' in poi i due flussi sono lo stesso flusso.
   */
  async function leggiIdentificazione(response: Response): Promise<Identification> {
    if (!response.ok || !response.body) {
      throw new Error(await readError(response, 'Identificazione non riuscita.'));
    }

    let identified: Identification | null = null;
    for await (const event of readAnalysisEvents<ListingEvent>(response.body)) {
      if (event.type === 'listing') {
        setListing(event.listing);
      } else if (event.type === 'photos') {
        // Nessuno stato: il numero di foto scaricate si vede gia' dal passo.
      } else if (event.type === 'partial') {
        setPartial(event.partial);
      } else if (event.type === 'identification') {
        identified = event.identification;
      } else {
        throw new Error(event.error);
      }
    }

    if (!identified) throw new Error('L’identificazione si e’ interrotta. Riprova.');
    return identified;
  }

  /** Dal link di un annuncio, invece che dalle foto che hai scattato tu. */
  async function analyzeLink(url: string) {
    ricomincia();
    try {
      const identified = await leggiIdentificazione(
        await fetch('/api/annuncio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        }),
      );
      await valuta(identified);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Qualcosa e’ andato storto.');
      setStage('idle');
    }
  }

  async function analyze() {
    ricomincia();

    try {
      const formData = new FormData();
      for (const image of images) formData.append('images', image.file);

      const identified = await leggiIdentificazione(
        await fetch('/api/identify', { method: 'POST', body: formData }),
      );
      await valuta(identified);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Qualcosa e’ andato storto.');
      setStage('idle');
    }
  }

  /** La stima, identica per le due porte: cambia solo da dove vengono le foto. */
  async function valuta(identified: Identification) {
    {
      setIdentification(identified);
      setStage('researching');

      const valuateResponse = await fetch('/api/valuate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identification: identified,
          // Il verdetto a un prezzo si calcola dopo, sul client, mentre
          // l'utente digita: qui servono solo stima e soglie.
          purchasePrice: null,
        }),
      });
      if (!valuateResponse.ok) {
        throw new Error(await readError(valuateResponse, 'Valutazione non riuscita.'));
      }
      if (!valuateResponse.body) throw new Error('Valutazione non riuscita.');

      let analysis: AnalysisResult | null = null;

      for await (const event of readAnalysisEvents(valuateResponse.body)) {
        if (event.type === 'lanes') {
          setLanes(
            event.lanes.map((lane) => ({ ...lane, status: 'running' as const, comparables: 0 })),
          );
        } else if (event.type === 'lane') {
          setLanes((current) =>
            current.map((lane) =>
              lane.id === event.lane.id
                ? { ...lane, status: event.lane.status, comparables: event.lane.comparables }
                : lane,
            ),
          );
        } else if (event.type === 'result') {
          analysis = event.result;
        } else if (event.type === 'cache') {
          setLanes([]);
          setReusedResearch({ ageDays: event.ageDays, comparables: event.comparables });
        } else if (event.type === 'source') {
          setStructuredSource({ label: event.label, comparables: event.comparables });
        } else if (event.type === 'usage') {
          // Solo in sviluppo: il server non lo manda in produzione.
          console.info('[usage] analisi', event.usage);
        } else {
          throw new Error(event.error);
        }
      }

      // Il flusso puo' chiudersi senza risultato solo se la connessione cade.
      if (!analysis) throw new Error('La valutazione si e’ interrotta. Riprova.');

      setResult(analysis);
      setStage('done');
    }
  }

  function reset() {
    for (const image of images) URL.revokeObjectURL(image.previewUrl);
    // L'indirizzo torna quello dell'analisi: l'oggetto di prima resta dov'e',
    // e questa pagina ricomincia da capo.
    window.history.replaceState(null, '', '/analizza');
    setItemId(null);
    setGiaSalvata(false);
    setImages([]);
    setPurchasePrice('');
    setResult(null);
    setIdentification(null);
    setPartial(NOTHING_YET);
    setListing(null);
    setSightings({ chiave: '', trovati: [] });
    setLanes([]);
    setReusedResearch(null);
    setStructuredSource(null);
    setError(null);
    setStage('idle');
  }

  /*
   * L'attesa prende tutto lo schermo.
   *
   * Prima restava una scheda in mezzo alla pagina, con l'intestazione sopra e
   * il resto del flusso intorno: per un minuto e mezzo in cui non c'e'
   * assolutamente nient'altro da fare, e in cui l'unica cosa che si vuole
   * sapere e' se sta ancora lavorando. Tutto quello che la circondava era
   * rumore intorno all'unica cosa viva.
   *
   * La foto sta in cima perche' e' la conferma piu' diretta che stiamo
   * guardando il *tuo* oggetto, e perche' riempie l'attesa con qualcosa di
   * concreto invece che con del bianco.
   */
  if (busy) {
    const copertina = images[0]?.previewUrl ?? null;

    return (
      <div className="flex min-h-[calc(100svh-8rem)] flex-col justify-center py-6">
        {copertina ? (
          <Image
            src={copertina}
            alt=""
            width={400}
            height={400}
            unoptimized
            className="mx-auto h-32 w-32 rounded-block border-[3px] border-line object-cover shadow-pop sm:h-40 sm:w-40"
          />
        ) : null}

        <h1 className="mt-6 text-center text-[clamp(1.75rem,1.4rem+1.8vw,2.5rem)] font-semibold leading-none tracking-tighter">
          Ci penso io
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          Da mezzo minuto a un paio. Puoi mettere via il telefono.
        </p>

        <div className="mt-6">
          <AnalysisProgress passi={passi} corsie={lanes} />
        </div>
      </div>
    );
  }

  if (stage === 'done' && liveResult) {
    return (
      <>
        <ResultView
          result={liveResult}
          coverUrl={images[0]?.previewUrl ?? listing?.imageUrls[0] ?? saved?.coverUrl ?? null}
          purchasePrice={purchasePrice}
          onPurchasePriceChange={setPurchasePrice}
          sightings={precedenti}
          calibration={calibration}
          listingSlot={
            listing ? <ListingCard listing={listing} identification={identification!} /> : null
          }
          saveSlot={
            giaSalvata ? null : (
              <AutoSave
                result={liveResult}
                images={images}
                listingImages={listing?.imageUrls ?? []}
                onSaved={setItemId}
              />
            )
          }
        />
        {/*
          Compare solo a salvataggio avvenuto: prima non c'e' niente da
          togliere dalla lista, e nessuna scheda da aprire.

          Il collegamento sta qui e non dentro `AutoSave` perche' deve esserci
          anche su un'analisi riaperta dal suo indirizzo, dove non c'e' niente
          da salvare e quel componente non viene montato affatto.
        */}
        {/* Compare solo dal terzo oggetto salvato in poi, e solo a chi non
            ha ancora un'email: decide da solo se esistere. */}
        {itemId ? <LinkAccountNudge /> : null}

        {itemId ? (
          <div className="mt-5 flex flex-col items-center gap-3">
            <Link
              href={`/inventario/${itemId}`}
              className="text-sm font-medium underline decoration-line underline-offset-4"
            >
              Registra com’e’ andata
            </Link>
            <ArchiveToggle itemId={itemId} archived={false} />
          </div>
        ) : null}
        <Button variant="ghost" className="mt-6 w-full" onClick={reset}>
          Analizza un altro oggetto
        </Button>
      </>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <PageHeader
        title="Da dove partiamo"
        subtitle="Fotografa quello che hai in mano, oppure incolla il link di un annuncio."
      />

      {error ? (
        <Card className="border-danger/40 bg-danger-soft">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      ) : null}

      {/*
        Il link sta in cima, non in fondo.

        Stava sotto il selettore delle foto e sotto tutto il blocco «cosa
        fotografare», con la motivazione che fotografare e' il caso al banco e
        il link quello sul divano. Guardata su un telefono, quella motivazione
        cadeva: chi arriva per incollare un link deve scorrere tre schermate di
        istruzioni su come scattare, cioe' il contenuto dell'altro caso d'uso.
        Sono due strade, e le due strade stanno affiancate.
      */}
      <ListingInput onSubmit={(url) => void analyzeLink(url)} />

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-0.5 flex-1 bg-line" />
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          oppure
        </span>
        <span className="h-0.5 flex-1 bg-line" />
      </div>

      <PhotoPicker images={images} onChange={setImages} />

      <Button className="w-full" disabled={images.length === 0} onClick={() => void analyze()}>
        Analizza le foto
      </Button>
    </div>
  );
}
