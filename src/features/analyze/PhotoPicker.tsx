'use client';

import Image from 'next/image';
import type { PreparedImage } from '@/lib/images';
import { Disclosure, Pill } from '@/components/ui';

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

/**
 * Le foto scelte, da riordinare e togliere.
 *
 * Sceglierle non si fa piu' qui: si fa nella barra unica, insieme al link e
 * alla nota. Questo componente e' quello che resta dopo, e compare solo se
 * c'e' qualcosa da mostrare.
 */
export function PhotoPicker({ images, onChange }: Props) {

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

  return (
    <div>
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
