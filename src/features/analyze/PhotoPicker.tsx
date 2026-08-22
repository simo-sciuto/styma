'use client';

import Image from 'next/image';
import { useRef, useState, type DragEvent } from 'react';
import { MAX_IMAGES } from '@/lib/uploads';
import { prepareImages, type PreparedImage } from '@/lib/images';

const GUIDANCE = [
  'Fronte',
  'Retro',
  'Lato',
  'Sotto / marchio',
  'Logo o numero di serie',
  'Difetti e usura',
  'Dettaglio del materiale',
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
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
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

        <button
          type="button"
          disabled={disabled || full || busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl bg-foreground px-5 py-3 text-base font-medium text-background transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Preparo le foto…' : images.length === 0 ? 'Scatta o scegli le foto' : 'Aggiungi foto'}
        </button>

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
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="group relative overflow-hidden rounded-xl border border-line">
              <Image
                src={image.previewUrl}
                alt={`Foto ${index + 1}`}
                width={200}
                height={200}
                unoptimized
                className="aspect-square w-full object-cover"
              />
              <span className="absolute left-1 top-1 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px]">
                {index + 1}
              </span>
              {!disabled ? (
                <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      aria-label={`Sposta la foto ${index + 1} indietro`}
                      className="rounded bg-background/85 px-1.5 text-xs"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      aria-label={`Sposta la foto ${index + 1} avanti`}
                      className="rounded bg-background/85 px-1.5 text-xs"
                    >
                      →
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(image.id)}
                    aria-label={`Rimuovi la foto ${index + 1}`}
                    className="rounded bg-background/85 px-1.5 text-xs text-danger"
                  >
                    ✕
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm font-medium">Cosa fotografare</p>
        <ul className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
          {GUIDANCE.map((item) => (
            <li key={item} className="rounded-full border border-line px-2.5 py-1">
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Il marchio sotto la base e i difetti sono gli scatti che cambiano di piu’ il risultato.
        </p>
      </div>
    </div>
  );
}
