'use client';

import { useState } from 'react';

import { Button, Card, Pill } from '@/components/ui';
import { Skeleton, SkeletonText } from '@/components/Skeleton';
import { formatEur } from '@/lib/format';
import {
  LISTING_MARKETPLACES,
  MARKETPLACE_LABELS,
  TITLE_LIMITS,
  type ListingCopy,
  type ListingMarketplace,
} from '@/schemas/listing';

type SuggestedPrice = {
  amount: number;
  low: number;
  high: number;
  confidence: 'high' | 'medium' | 'low';
} | null;

type Props = { itemId: string };

type Stage = 'idle' | 'loading' | 'error' | 'done';

/**
 * Nessuno di questi marketplace ha un'API pubblica per pubblicare al posto
 * tuo: qualunque cosa promettesse "annuncio pubblicato" mentirebbe. Questo
 * prepara testo e prezzo su misura per ciascuno, pronti da copiare —
 * l'ultimo passo, incollarlo, resta a chi vende.
 */
export function GenerateListing({ itemId }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [listing, setListing] = useState<ListingCopy | null>(null);
  const [price, setPrice] = useState<SuggestedPrice>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [marketplace, setMarketplace] = useState<ListingMarketplace>('vinted');

  async function generate() {
    setStage('loading');
    setError(null);

    try {
      const response = await fetch('/api/listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Non siamo riusciti a scrivere l’annuncio.');
      }

      const data = (await response.json()) as { listing: ListingCopy; price: SuggestedPrice };
      setListing(data.listing);
      setPrice(data.price);
      setStage('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Qualcosa e’ andato storto.');
      setStage('error');
    }
  }

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((current) => (current === label ? null : current)), 1500);
    } catch {
      // Il clipboard puo' non essere disponibile: non e' un motivo per bloccare la pagina.
    }
  }

  if (stage === 'idle' || stage === 'error') {
    return (
      <div className="space-y-2">
        <Button variant="ghost" className="w-full" onClick={() => void generate()}>
          Scrivi l’annuncio
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    );
  }

  if (stage === 'loading') {
    /*
     * L'ultimo posto dell'app che si era inventato un'attesa tutta sua: una
     * riga di testo che pulsava, con un'animazione scritta a mano nello
     * `style` inline. Oltre a essere l'unica in tutto il prodotto, spariva il
     * bottone e lasciava al suo posto tre parole, quindi la pagina saltava su
     * di ottanta pixel nel momento in cui il dito era ancora li'.
     *
     * Lo scheletro ha la forma di quello che arrivera': prezzo, linguette dei
     * marketplace, titolo, descrizione. Chi aspetta sa gia' dove guardera', e
     * niente si sposta quando il testo arriva.
     */
    return (
      <Card className="space-y-4">
        <p role="status" className="sr-only">
          Scrivo l’annuncio
        </p>

        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-8 w-32" />
          <Skeleton className="mt-2 h-3 w-48" />
        </div>

        <div className="flex gap-1.5">
          <Skeleton className="h-8 w-20 rounded-block" />
          <Skeleton className="h-8 w-16 rounded-block" />
          <Skeleton className="h-8 w-20 rounded-block" />
        </div>

        <div>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-4 w-11/12" />
        </div>

        <div>
          <Skeleton className="h-3 w-24" />
          <SkeletonText className="mt-2" lines={4} />
        </div>

        <p className="text-center text-xs text-muted">
          Una decina di secondi.
        </p>
      </Card>
    );
  }

  if (!listing) return null;

  const title = listing.titles[marketplace];
  const limit = TITLE_LIMITS[marketplace];
  const overLimit = title.length > limit;
  const fullText = [title, '', listing.description, '', listing.keywords.join(' · ')].join('\n');

  return (
    <Card className="space-y-4">
      {price ? (
        <div>
          <p className="text-sm text-muted">Prezzo suggerito</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{formatEur(price.amount)}</p>
          <p className="mt-1 text-xs text-muted">
            Fascia di prezzo {formatEur(price.low)}–{formatEur(price.high)}
            {price.confidence !== 'high'
              ? ` · stima a confidenza ${price.confidence === 'medium' ? 'media' : 'bassa'}: guardala prima di fissare il prezzo`
              : null}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Nessuna stima per questo oggetto. Il prezzo lo decidi tu.
        </p>
      )}

      {/* Il titolo cambia per marketplace, la descrizione no: sotto c'e' lo
          stesso oggetto, e i fatti su un oggetto non cambiano col sito. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {LISTING_MARKETPLACES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMarketplace(option)}
            aria-pressed={option === marketplace}
            className={`shrink-0 rounded-block border-2 border-line px-3.5 py-1.5 text-sm font-semibold transition ${
              option === marketplace
                ? 'bg-tile-teal text-tile-cream'
                : 'bg-surface text-muted hover:text-foreground'
            }`}
          >
            {MARKETPLACE_LABELS[option]}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted">Titolo per {MARKETPLACE_LABELS[marketplace]}</p>
          <button
            type="button"
            onClick={() => void copy('title', title)}
            className="text-xs text-muted underline decoration-line underline-offset-4 hover:text-foreground"
          >
            {copied === 'title' ? 'Copiato' : 'Copia'}
          </button>
        </div>
        <p className="mt-1 font-medium">{title}</p>
        <p className={`mt-1 font-mono text-xs ${overLimit ? 'text-danger' : 'text-muted'}`}>
          {title.length}/{limit} caratteri
          {overLimit ? ' · accorcialo prima di incollarlo' : null}
        </p>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted">Descrizione</p>
          <button
            type="button"
            onClick={() => void copy('description', listing.description)}
            className="text-xs text-muted underline decoration-line underline-offset-4 hover:text-foreground"
          >
            {copied === 'description' ? 'Copiato' : 'Copia'}
          </button>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{listing.description}</p>
      </div>

      {listing.keywords.length > 0 ? (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-muted">Parole chiave</p>
            <button
              type="button"
              onClick={() => void copy('keywords', listing.keywords.join(', '))}
              className="text-xs text-muted underline decoration-line underline-offset-4 hover:text-foreground"
            >
              {copied === 'keywords' ? 'Copiate' : 'Copia'}
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {listing.keywords.map((keyword) => (
              <Pill key={keyword}>{keyword}</Pill>
            ))}
          </div>
        </div>
      ) : null}

      <Button variant="ghost" className="w-full" onClick={() => void copy('all', fullText)}>
        {copied === 'all' ? 'Copiato tutto' : `Copia tutto per ${MARKETPLACE_LABELS[marketplace]}`}
      </Button>
    </Card>
  );
}
