'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button, Card, PageHeader } from '@/components/ui';
import { readAnalysisEvents } from '@/lib/analysis-stream';
import { assessFlip } from '@/services/valuation/flip-score';
import type { PreparedImage } from '@/lib/images';
import type { AnalysisResult } from '@/schemas/analysis';
import type { Identification } from '@/schemas/identification';
import { ArchiveToggle } from '@/features/inventory/ArchiveToggle';
import { AutoSave } from '@/features/inventory/AutoSave';
import { usePersistAskingPrice } from '@/features/inventory/useAskingPrice';
import { AnalysisProgress, type Passo } from './AnalysisProgress';
import { PhotoPicker } from './PhotoPicker';
import { ResultView } from './ResultView';

type Stage = 'idle' | 'identifying' | 'researching' | 'done';

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

export function AnalyzeFlow() {
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [identification, setIdentification] = useState<Identification | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [lanes, setLanes] = useState<LaneProgress[]>([]);
  const [reusedResearch, setReusedResearch] = useState<{ ageDays: number; comparables: number } | null>(
    null,
  );
  const [structuredSource, setStructuredSource] = useState<{
    label: string;
    comparables: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** L'id dell'oggetto salvato: e' l'indirizzo a cui questa analisi vive. */
  const [itemId, setItemId] = useState<string | null>(null);

  const busy = stage === 'identifying' || stage === 'researching';

  /**
   * Appena l'oggetto esiste, l'indirizzo della pagina diventa il suo.
   *
   * `history.replaceState` e non una navigazione: navigare qui rimonterebbe
   * la pagina e butterebbe via il risultato appena arrivato, per rileggerlo
   * dal database un istante dopo. Cosi' la pagina resta quella che sta gia'
   * leggendo, e ricaricando si riapre l'analisi salvata.
   */
  useEffect(() => {
    if (itemId) window.history.replaceState(null, '', `/inventario/${itemId}`);
  }, [itemId]);

  // Il prezzo si scrive dopo il salvataggio automatico, quindi va portato
  // all'oggetto man mano che lo digiti. Parte da vuoto: e' quello che
  // `saveAnalysis` ha appena messo nel database.
  usePersistAskingPrice(itemId, purchasePrice, '');

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
  const passi: Passo[] = [
    {
      titolo: 'Riconosco l’oggetto',
      durante: 'Leggo forma, materiali, marchi e punzoni.',
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

  async function analyze() {
    setError(null);
    setResult(null);
    setIdentification(null);
    setLanes([]);
    setReusedResearch(null);
    setStructuredSource(null);
    setStage('identifying');

    try {
      const formData = new FormData();
      for (const image of images) formData.append('images', image.file);

      const identifyResponse = await fetch('/api/identify', { method: 'POST', body: formData });
      if (!identifyResponse.ok) {
        throw new Error(await readError(identifyResponse, 'Identificazione non riuscita.'));
      }

      const { identification: identified } = (await identifyResponse.json()) as {
        identification: Identification;
      };
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Qualcosa e’ andato storto.');
      setStage('idle');
    }
  }

  function reset() {
    for (const image of images) URL.revokeObjectURL(image.previewUrl);
    // L'indirizzo torna quello dell'analisi: l'oggetto di prima resta dov'e',
    // e questa pagina ricomincia da capo.
    window.history.replaceState(null, '', '/analizza');
    setItemId(null);
    setImages([]);
    setPurchasePrice('');
    setResult(null);
    setIdentification(null);
    setLanes([]);
    setReusedResearch(null);
    setStructuredSource(null);
    setError(null);
    setStage('idle');
  }

  if (stage === 'done' && liveResult) {
    return (
      <>
        <ResultView
          result={liveResult}
          coverUrl={images[0]?.previewUrl ?? null}
          purchasePrice={purchasePrice}
          onPurchasePriceChange={setPurchasePrice}
          saveSlot={<AutoSave result={liveResult} images={images} onSaved={setItemId} />}
        />
        {/* Compare solo a salvataggio avvenuto: prima non c'e' niente da
            togliere dalla lista. */}
        {itemId ? (
          <div className="mt-4 text-center">
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
        title={busy ? 'Ci penso io' : 'Fotografa l’oggetto'}
        subtitle={
          busy
            ? 'Puoi mettere via il telefono: ci vuole da mezzo minuto a un paio.'
            : 'Da 4 a 8 foto danno il risultato migliore. Se l’oggetto e’ evidente, ne bastano meno.'
        }
      />

      {/* Durante l'attesa il lavoro in corso viene prima delle foto: sono
          gia' scelte, e quello che si vuole guardare e' cosa sta succedendo. */}
      {busy ? <AnalysisProgress passi={passi} corsie={lanes} /> : null}

      <PhotoPicker images={images} onChange={setImages} disabled={busy} />

      {error ? (
        <Card className="border-danger/40 bg-danger-soft">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      ) : null}

      {busy ? null : (
        <Button className="w-full" disabled={images.length === 0} onClick={() => void analyze()}>
          Analizza
        </Button>
      )}
    </div>
  );
}
