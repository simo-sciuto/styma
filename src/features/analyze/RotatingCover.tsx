'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

/**
 * Le foto dell'oggetto che si alternano durante l'attesa.
 *
 * Con una foto sola restava una foto sola, ed era gia' meglio del vuoto. Con
 * otto, mostrarne una e tenere le altre da parte per un minuto e mezzo e' uno
 * spreco: sono quelle che il modello sta guardando in questo momento, e farle
 * passare e' la cosa piu' vicina a far vedere il lavoro che sta succedendo.
 *
 * Nessun indicatore, nessun pallino: non e' una galleria da sfogliare, e' la
 * stessa cosa che guarda lui.
 */
const DURATA_MS = 2200;

export function RotatingCover({ urls, alt = '' }: { urls: string[]; alt?: string }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (urls.length < 2) return;
    const timer = setInterval(() => {
      setIndice((corrente) => (corrente + 1) % urls.length);
    }, DURATA_MS);
    return () => clearInterval(timer);
  }, [urls.length]);

  if (urls.length === 0) return null;
  const corrente = urls[indice % urls.length]!;

  return (
    <div className="scansione relative mx-auto h-32 w-32 overflow-hidden rounded-block border-[3px] border-line shadow-pop sm:h-40 sm:w-40">
      <Image
        // La chiave forza il rimonto a ogni cambio, e con lui la dissolvenza:
        // sostituire la sorgente sullo stesso nodo farebbe uno scatto.
        key={corrente}
        src={corrente}
        alt={alt}
        width={400}
        height={400}
        unoptimized
        className="dissolvenza h-full w-full object-cover"
      />

      {/*
        La riga che scorre sta sopra la foto, non accanto: e' quello che sta
        succedendo davvero — quella fotografia, guardata adesso — e messa di
        fianco raccontava la stessa cosa senza dire su cosa.
      */}
      <span aria-hidden className="scansione-riga absolute inset-x-0 h-[3px] bg-tile-teal shadow-[0_0_12px_2px_var(--tile-teal)]" />
    </div>
  );
}
