'use client';

import { useEffect, useRef, useState } from 'react';

import { Card } from '@/components/ui';
import type { PreparedImage } from '@/lib/images';
import { ensureSession, getBrowserSupabase } from '@/lib/supabase/client';
import { isPersistenceEnabled } from '@/lib/supabase/env';
import type { AnalysisResult } from '@/schemas/analysis';
import { IMAGE_BUCKET } from '@/services/inventory/types';
import { importListingImages, registerImages, saveAnalysis } from './actions';

/**
 * Ogni analisi si salva da sola, appena finisce.
 *
 * Prima c'era un pulsante, e un'analisi non salvata si perdeva ricaricando la
 * pagina: minuti di attesa e qualche centesimo buttati da un tocco sbagliato,
 * e nessun indirizzo da riaprire o da mandare a qualcuno. Peggio ancora, si
 * salvava solo cio' che valeva la pena tenere — cioe' proprio la meta' del
 * magazzino che non insegna niente.
 *
 * Il salvataggio non blocca la lettura: il risultato e' gia' in pagina, e
 * questo lavora dietro. Un salvataggio fallito si dice, perche' e' l'unico
 * caso in cui l'indirizzo non esiste e chi legge deve saperlo prima di
 * chiudere.
 */
export function AutoSave({
  result,
  images,
  listingImages = [],
  onSaved,
}: {
  result: AnalysisResult;
  images: PreparedImage[];
  /**
   * Le foto dell'annuncio, quando si e' partiti da un link e non da file
   * scelti a mano. Le scarica e le archivia il server: un inventario che
   * punta a URL di Vinted si svuota da solo il giorno in cui quell'annuncio
   * viene venduto.
   */
  listingImages?: string[];
  /** Chiamato con l'id appena l'oggetto esiste: e' li' che nasce l'indirizzo. */
  onSaved: (itemId: string) => void;
}) {
  const [state, setState] = useState<'saving' | 'saved' | 'failed'>('saving');
  const [error, setError] = useState<string | null>(null);

  // Il risultato cambia a ogni cifra digitata nel prezzo — il verdetto si
  // ricalcola — ma il salvataggio deve partire una volta sola.
  const partito = useRef(false);
  const primoRisultato = useRef(result);
  const immagini = useRef(images);
  const dallAnnuncio = useRef(listingImages);
  const segnala = useRef(onSaved);
  useEffect(() => {
    segnala.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    if (!isPersistenceEnabled() || partito.current) return;
    partito.current = true;

    void (async () => {
      try {
        const userId = await ensureSession();

        // Il prezzo del banco non si conosce ancora: si scrive dopo, e viene
        // aggiornato mentre lo digiti.
        const saved = await saveAnalysis(primoRisultato.current, null);
        if (!saved.ok) throw new Error(saved.error);

        setState('saved');
        segnala.current(saved.itemId);

        if (immagini.current.length === 0 && dallAnnuncio.current.length > 0) {
          await importListingImages(saved.itemId, dallAnnuncio.current);
        }

        const supabase = getBrowserSupabase();
        if (supabase && immagini.current.length > 0) {
          const paths: string[] = [];
          for (const [index, image] of immagini.current.entries()) {
            const path = `${userId}/${saved.itemId}/${String(index).padStart(2, '0')}.jpg`;
            const { error: uploadError } = await supabase.storage
              .from(IMAGE_BUCKET)
              .upload(path, image.file, { contentType: image.file.type, upsert: true });
            // Una foto non caricata non deve far perdere l'analisi appena salvata.
            if (!uploadError) paths.push(path);
          }
          await registerImages(saved.itemId, paths);
        }
      } catch (caught) {
        setState('failed');
        setError(caught instanceof Error ? caught.message : 'Salvataggio non riuscito.');
      }
    })();
  }, []);

  if (!isPersistenceEnabled()) {
    return (
      <p className="pt-2 text-center text-xs text-muted">
        Inventario non configurato. Questa analisi si perde se ricarichi.
      </p>
    );
  }

  if (state === 'failed') {
    return (
      <Card className="border-danger/40 bg-danger-soft">
        <p className="text-sm text-danger">
          Questa analisi non e’ stata salvata{error ? `: ${error}` : '.'} Resta leggibile finche’
          non ricarichi la pagina.
        </p>
      </Card>
    );
  }

  return (
    <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-muted">
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current ${
          state === 'saving' ? 'pending-dot visible' : 'invisible'
        }`}
      />
      {state === 'saving' ? 'Salvo in inventario' : 'Salvato in inventario: resta a questo indirizzo.'}
    </p>
  );
}
