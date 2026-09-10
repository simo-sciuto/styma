'use client';

import { useState } from 'react';

import { Button, Card, Pill } from '@/components/ui';
import { formatEur } from '@/lib/format';
import type { ListingCopy } from '@/schemas/listing';

type SuggestedPrice = {
  amount: number;
  low: number;
  high: number;
  confidence: 'high' | 'medium' | 'low';
} | null;

type Props = { itemId: string };

type Stage = 'idle' | 'loading' | 'error' | 'done';

/**
 * Vinted non ha un'API per pubblicare: qualunque cosa promettesse "annuncio
 * pubblicato" mentirebbe. Questo prepara il testo e il prezzo, pronti da
 * copiare — l'ultimo passo, incollarlo su Vinted, resta a chi vende.
 */
export function GenerateListing({ itemId }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [listing, setListing] = useState<ListingCopy | null>(null);
  const [price, setPrice] = useState<SuggestedPrice>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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
          Scrivi l’annuncio per Vinted
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    );
  }

  if (stage === 'loading') {
    return (
      <p className="text-sm text-muted" style={{ animation: 'styma-pulse 1.6s ease-in-out infinite' }}>
        Scrivo l’annuncio…
      </p>
    );
  }

  if (!listing) return null;

  const fullText = [listing.title, '', listing.description, '', listing.keywords.join(' · ')].join('\n');

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
          Nessuna valutazione disponibile per questo oggetto: il prezzo lo decidi tu.
        </p>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted">Titolo</p>
          <button
            type="button"
            onClick={() => void copy('title', listing.title)}
            className="text-xs text-muted underline decoration-line underline-offset-4 hover:text-foreground"
          >
            {copied === 'title' ? 'Copiato' : 'Copia'}
          </button>
        </div>
        <p className="mt-1 font-medium">{listing.title}</p>
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
          <p className="text-sm text-muted">Parole chiave</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {listing.keywords.map((keyword) => (
              <Pill key={keyword}>{keyword}</Pill>
            ))}
          </div>
        </div>
      ) : null}

      <Button variant="ghost" className="w-full" onClick={() => void copy('all', fullText)}>
        {copied === 'all' ? 'Copiato tutto' : 'Copia tutto'}
      </Button>
    </Card>
  );
}
