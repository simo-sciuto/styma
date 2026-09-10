'use client';

import Image from 'next/image';
import { useRef, useState, type DragEvent } from 'react';
import { MAX_IMAGES } from '@/lib/uploads';
import { prepareImages, type PreparedImage } from '@/lib/images';
import { Button, Pill } from '@/components/ui';

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
          disabled={disabled || full || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Preparo le foto…' : images.length === 0 ? 'Scatta o scegli le foto' : 'Aggiungi foto'}
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

      <div className="mt-4 rounded-block border border-line bg-surface p-4">
        <p className="text-sm font-medium">Cosa fotografare</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {GUIDANCE.map((item) => (
            <Pill key={item}>{item}</Pill>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Il marchio sotto la base e i difetti sono gli scatti che cambiano di piu’ il risultato.
        </p>
      </div>
    </div>
  );
}
