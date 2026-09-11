'use client';

import { useState } from 'react';

import { Button } from '@/components/ui';
import { parseListingUrl } from '@/services/listings/parse';

/**
 * L'altra porta d'ingresso: un link invece di una fotografia.
 *
 * Nasce da come si usa il telefono davvero. Stai scorrendo Vinted, vedi una
 * cosa che forse conviene, e per saperlo dovresti uscire dall'app, aprire
 * questa, e fotografare uno schermo. Il link ce l'hai gia' in mano: e' l'unica
 * cosa che quel momento ti da' gratis.
 *
 * Il controllo sul link e' qui e anche sul server. Qui serve a dire subito
 * cosa sappiamo leggere, invece di far aspettare sei secondi per un no; sul
 * server serve perche' quel link lo apre il nostro backend, e un controllo che
 * vive solo nel browser non e' un controllo.
 */
export function ListingInput({
  onSubmit,
  disabled = false,
}: {
  onSubmit: (url: string) => void;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState('');

  const pulito = url.trim();
  const riconosciuto = pulito === '' ? null : parseListingUrl(pulito);
  const sbagliato = pulito !== '' && riconosciuto === null;

  return (
    <form
      className="flex h-full flex-col rounded-block border-2 border-line bg-surface p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (riconosciuto) onSubmit(riconosciuto.url);
      }}
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
        L’hai visto online
      </p>
      <p className="mt-1.5 text-sm text-muted">
        Incolla il link di un annuncio, da Vinted o da eBay. Guardiamo le sue foto.
      </p>

      <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="vinted.it/items/…"
          aria-label="Link dell’annuncio"
          aria-invalid={sbagliato || undefined}
          className="min-w-0 rounded-block border-2 border-line bg-background px-4 py-2.5 text-base outline-none focus:border-accent"
        />
        <Button type="submit" className="w-full" disabled={disabled || riconosciuto === null}>
          Guarda l’annuncio
        </Button>
        {sbagliato ? (
          <p className="text-xs text-warn">
            Questo link non lo sappiamo leggere. Per ora, Vinted e eBay.
          </p>
        ) : (
          <p className="text-xs text-muted">Vinted, eBay</p>
        )}
      </div>
    </form>
  );
}
