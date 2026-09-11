'use client';

import { useRef, useState } from 'react';

import { prepareImages, type PreparedImage } from '@/lib/images';
import { MAX_IMAGES } from '@/lib/uploads';
import { parseListingUrl } from '@/services/listings/parse';

/**
 * Una barra sola, non due schede.
 *
 * Fotografare e incollare un link erano due blocchi gemelli, affiancati e
 * dello stesso peso — che era gia' meglio di una strada e un ripiego, ma
 * chiedeva comunque di scegliere una porta prima di cominciare. Se le due
 * cose sono davvero equivalenti, la domanda «quale delle due?» non andrebbe
 * fatta: c'e' un oggetto, e tu hai una foto o un indirizzo.
 *
 * Qui c'e' un campo. Ci metti dentro quello che hai: scatti, un link, o due
 * righe di quello che sai e la foto non mostra. La barra capisce da sola cosa
 * le hai dato, e il pulsante fa una cosa sola.
 *
 * La nota vive nello stesso posto e non in un campo suo, perche' non e' un
 * terzo modo di cominciare: e' quello che aggiungi mentre stai gia'
 * cominciando. «Premi invio, o aggiungi una nota» e' la frase giusta al
 * momento giusto — e chiedere la nota prima della foto sarebbe chiedere di
 * descrivere un oggetto che non abbiamo ancora guardato.
 */
export function StartBar({
  images,
  onImagesChange,
  onAnalyzePhotos,
  onAnalyzeLink,
  busy = false,
}: {
  images: PreparedImage[];
  onImagesChange: (images: PreparedImage[]) => void;
  /** Analizza le foto, con la nota scritta accanto. */
  onAnalyzePhotos: (note: string) => void;
  onAnalyzeLink: (url: string) => void;
  busy?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [testo, setTesto] = useState('');
  const [dragging, setDragging] = useState(false);
  const [errori, setErrori] = useState<string[]>([]);
  const [caricando, setCaricando] = useState(false);

  const scritto = testo.trim();
  const link = scritto === '' ? null : parseListingUrl(scritto);
  /* Un testo che *sembra* un indirizzo ma non lo sappiamo leggere non e' una
     nota: e' un link sbagliato, e dirlo subito evita un'analisi delle foto
     con dentro un URL al posto di quello che sai. */
  const sembraLink = /^(https?:\/\/|www\.)|\.[a-z]{2,}\//i.test(scritto);
  const linkRotto = sembraLink && link === null;

  const pieno = images.length >= MAX_IMAGES;
  const pronto = link !== null || (images.length > 0 && !linkRotto);

  async function aggiungi(files: FileList | File[]) {
    setCaricando(true);
    const { images: pronte, errors } = await prepareImages(Array.from(files), images.length);
    onImagesChange([...images, ...pronte]);
    setErrori(errors);
    setCaricando(false);
  }

  function invia() {
    if (!pronto || busy) return;
    if (link) onAnalyzeLink(link.url);
    else onAnalyzePhotos(scritto);
  }

  const segnaposto =
    images.length > 0
      ? 'Premi invio, o aggiungi quello che la foto non dice'
      : 'Fotografa l’oggetto, o incolla il link di un annuncio';

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          invia();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length > 0) void aggiungi(event.dataTransfer.files);
        }}
        className={`flex items-center gap-2 rounded-block border-[3px] p-2 shadow-pop transition ${
          dragging ? 'border-tile-teal bg-accent-soft' : 'border-line bg-surface'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void aggiungi(event.target.files);
            event.target.value = '';
          }}
        />

        <button
          type="button"
          disabled={pieno || busy}
          onClick={() => inputRef.current?.click()}
          aria-label="Scatta o scegli le foto"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.6rem] border-2 border-line bg-tile-teal text-tile-cream transition disabled:opacity-40"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
            <circle cx="12" cy="13" r="3.4" />
          </svg>
        </button>

        <input
          type="text"
          value={testo}
          onChange={(event) => setTesto(event.target.value)}
          placeholder={segnaposto}
          aria-label="Link dell’annuncio o nota sull’oggetto"
          aria-invalid={linkRotto || undefined}
          disabled={busy}
          maxLength={400}
          className="min-w-0 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted"
        />

        <button
          type="submit"
          disabled={!pronto || busy}
          aria-label="Analizza"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.6rem] border-2 border-line bg-verdict-buy text-tile-ink transition-[transform,box-shadow] duration-100 shadow-pop-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:border-line disabled:bg-surface disabled:text-muted disabled:opacity-50 disabled:shadow-none"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h13M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>

      <p className="mt-2 px-1 text-xs text-muted">
        {linkRotto ? (
          <span className="text-warn">Questo link non lo sappiamo leggere. Per ora, Vinted e eBay.</span>
        ) : link ? (
          `Leggiamo l’annuncio su ${link.source === 'vinted' ? 'Vinted' : 'eBay'}.`
        ) : images.length > 0 ? (
          `${images.length}/${MAX_IMAGES} foto${caricando ? ' · preparo…' : ''}`
        ) : (
          'Vinted, eBay, o le tue foto.'
        )}
      </p>

      {errori.length > 0 ? (
        <ul className="mt-1 space-y-1 px-1 text-sm text-danger">
          {errori.map((errore) => (
            <li key={errore}>{errore}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
