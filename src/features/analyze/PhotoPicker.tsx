'use client';

import Image from 'next/image';
import { useRef, useState, type DragEvent } from 'react';
import { MAX_IMAGES } from '@/lib/uploads';
import { prepareImages, type PreparedImage } from '@/lib/images';
import { Button, Disclosure, Pill } from '@/components/ui';

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
};

export function PhotoPicker({ images, onChange }: Props) {
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
    if (event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files);
  }

  const full = images.length >= MAX_IMAGES;

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex h-full flex-col rounded-block border-2 p-4 transition sm:p-5 ${
          dragging ? 'border-tile-teal bg-accent-soft' : 'border-line bg-surface'
        }`}
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Ce l’hai davanti
        </p>
        <p className="mt-1.5 text-sm text-muted">
          Fotografa l’oggetto. Da quattro a otto scatti, meno se e’ evidente.
        </p>
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

        <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
          <Button
            type="button"
            className="w-full"
            pending={busy}
            disabled={full}
            onClick={() => inputRef.current?.click()}
          >
            {images.length === 0 ? 'Scatta o scegli le foto' : 'Aggiungi foto'}
          </Button>

          <p className="text-xs text-muted">
            {images.length}/{MAX_IMAGES} foto · su desktop puoi trascinarle qui
          </p>
        </div>
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
              className="overflow-hidden rounded-block border-2 border-line bg-surface"
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
              <div className="flex items-center justify-between gap-1 border-t-2 border-line px-1.5 py-1">
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
            </li>
          ))}
        </ul>
      ) : null}

    </div>
  );
}

/**
 * Cosa fotografare, fuori dalla scheda che la ospitava.
 *
 * Stava dentro il selettore, e da sola pesava tre schermate: accanto a un
 * campo per incollare un link faceva sembrare la fotografia la strada
 * principale e il link un ripiego. Sono due mezzi per la stessa cosa, uno dal
 * vivo e uno virtuale, e devono pesare uguale. La guida resta, chiusa, sotto
 * tutte e due.
 */
export function PhotoGuidance() {
  return (
    <Disclosure summary="Cosa fotografare" hint="Le foto che cambiano il risultato">
      <div className="space-y-4">
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
    </Disclosure>
  );
}
