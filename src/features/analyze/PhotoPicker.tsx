'use client';

import Image from 'next/image';
import { useRef, useState, type DragEvent } from 'react';
import { MAX_IMAGES } from '@/lib/uploads';
import { prepareImages, type PreparedImage } from '@/lib/images';
import { Button, Pill } from '@/components/ui';

/**
 * Non un elenco di scatti ma tre gruppi con un motivo ciascuno.
 *
 * «Da 4 a 8 foto» non dice a nessuno quali. E le sette voci di prima erano
 * identiche per un vaso e per una fotocamera, il che le rendeva vere e
 * inutili insieme: la guida davvero specifica arriva dopo la prima analisi,
 * quando sappiamo cos'e' e possiamo dire quale scatto manca.
 */
const GUIDANCE = [
  {
    title: 'Sempre',
    why: 'Senza non si parte.',
    shots: ['L’oggetto intero'],
  },
  {
    title: 'Quelle che cambiano il risultato',
    why: 'Marchi ed etichette spostano l’identificazione piu’ di qualsiasi altra foto: da «forse e’ questo» a «e’ questo».',
    shots: ['Sotto o dietro', 'Marchio o punzone', 'Etichetta', 'Numero di serie', 'Firma'],
  },
  {
    title: 'Lo stato',
    why: 'Quello che non fotografi resta non valutato, e in rivendita diventa una sorpresa per chi compra.',
    shots: ['Crepe e scheggiature', 'Usura', 'Riparazioni', 'Parti mancanti'],
  },
];

type Props = {
  images: PreparedImage[];
  onChange: (images: PreparedImage[]) => void;
  disabled?: boolean;
};

export function PhotoPicker({ images, onChange, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function addFiles(files: FileList | File[]) {
    setBusy(true);
    const { images: prepared, errors: issues } = await prepareImages(Array.from(files), images.length);
    onChange([...images, ...prepared]);
    setErrors(issues);
    setBusy(false);
  }

  function remove(id: string) {
    const target = images.find((image) => image.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(images.filter((image) => image.id !== id));
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    if (event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files);
  }

  const full = images.length >= MAX_IMAGES;

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-block border-2 border-dashed p-6 text-center transition sm:p-8 ${
          dragging ? 'border-tile-teal bg-accent-soft' : 'border-line bg-surface'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = '';
          }}
        />

        <div
          aria-hidden
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tile-teal text-tile-cream"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
            <circle cx="12" cy="13" r="3.4" />
          </svg>
        </div>

        <Button
          type="button"
          className="mt-4"
          pending={busy}
          disabled={disabled || full}
          onClick={() => inputRef.current?.click()}
        >
          {images.length === 0 ? 'Scatta o scegli le foto' : 'Aggiungi foto'}
        </Button>

        <p className="mt-3 text-sm text-muted">
          {images.length}/{MAX_IMAGES} foto · trascina qui i file su desktop
        </p>
      </div>

      {errors.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-danger">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {images.length > 0 ? (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
            >
              <div className="relative">
                <Image
                  src={image.previewUrl}
                  alt={`Foto ${index + 1}`}
                  width={200}
                  height={200}
                  unoptimized
                  className="aspect-square w-full object-cover"
                />
                <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-tile-teal font-mono text-xs text-tile-cream">
                  {index + 1}
                </span>
              </div>
              {!disabled ? (
                <div className="flex items-center justify-between gap-1 border-t border-line px-1.5 py-1">
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Sposta la foto ${index + 1} indietro`}
                      className="rounded-full px-2 py-1.5 text-sm text-muted transition hover:bg-accent-soft hover:text-foreground disabled:opacity-30 sm:px-2.5"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === images.length - 1}
                      aria-label={`Sposta la foto ${index + 1} avanti`}
                      className="rounded-full px-2.5 py-1.5 text-sm text-muted transition hover:bg-accent-soft hover:text-foreground disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(image.id)}
                    aria-label={`Rimuovi la foto ${index + 1}`}
                    className="rounded-full px-2 py-1.5 text-xs text-danger transition hover:bg-danger-soft sm:px-2.5 sm:text-sm"
                  >
                    Rimuovi
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Mentre l'analisi gira, le foto sono gia' scelte: la guida su cosa
          fotografare diventa il blocco piu' alto della pagina e copre il
          lavoro in corso, che e' l'unica cosa che si vuole guardare. */}
      <div
        className={`mt-4 space-y-4 rounded-block border border-line bg-surface p-4 ${
          disabled ? 'hidden' : ''
        }`}
      >
        <p className="text-sm font-medium">Cosa fotografare</p>
        {GUIDANCE.map((group) => (
          <div key={group.title}>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
              {group.title}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {group.shots.map((shot) => (
                <Pill key={shot}>{shot}</Pill>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">{group.why}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
