'use client';

import { Card } from '@/components/ui';
import { formatEur } from '@/lib/format';
import type { Identification } from '@/schemas/identification';
import { SOURCE_LABELS } from '@/services/listings/parse';
import type { SharedListing } from '@/services/listings/types';

/**
 * Cosa dice l'annuncio, accanto a cosa vediamo noi.
 *
 * Il titolo, la marca, lo stato sono dichiarazioni di chi vende, e la
 * tentazione di mescolarle con la nostra identificazione e' forte perche' il
 * risultato sembrerebbe piu' ricco. Sarebbe anche piu' fragile: se il
 * venditore scrive «Olivetti Valentine» e le foto mostrano una Lettera 32, il
 * disaccordo e' l'informazione piu' utile di tutta la pagina, e mescolando le
 * due cose sparirebbe.
 *
 * Quindi restano due colonne. Quando dicono la stessa cosa, chi legge si
 * fida di piu'. Quando non la dicono, lo vede.
 */
function confronta(dichiarato: string | null, visto: string | null): 'uguale' | 'diverso' | 'solo' {
  if (!dichiarato || !visto) return 'solo';
  const normalizza = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  const a = normalizza(dichiarato);
  const b = normalizza(visto);
  return a === b || a.includes(b) || b.includes(a) ? 'uguale' : 'diverso';
}

function Riga({
  etichetta,
  dichiarato,
  visto,
}: {
  etichetta: string;
  dichiarato: string | null;
  visto: string | null;
}) {
  if (!dichiarato && !visto) return null;
  const esito = confronta(dichiarato, visto);

  return (
    <div className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-0.5 border-t-2 border-line py-2 first:border-0 first:pt-0">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{etichetta}</p>
      <div className="min-w-0">
        <p className="text-sm">
          {dichiarato ?? <span className="text-muted">non dichiarato</span>}
        </p>
        {/* La nostra lettura si scrive solo quando aggiunge qualcosa: ripetere
            la stessa parola due volte riempie la pagina e non dice niente. */}
        {esito === 'diverso' ? (
          <p className="text-sm text-warn">Noi vediamo: {visto}</p>
        ) : esito === 'solo' && visto ? (
          <p className="text-sm text-muted">Noi vediamo: {visto}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ListingCard({
  listing,
  identification,
}: {
  listing: SharedListing;
  identification: Identification;
}) {
  const marcaDiversa = confronta(listing.brand, identification.brand) === 'diverso';
  const usaLeSueParole = identification.model === null;

  return (
    <Card className="bg-surface-warm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Cosa dice l’annuncio
        </p>
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs font-medium underline decoration-line underline-offset-4"
        >
          Aprilo su {SOURCE_LABELS[listing.source]}
        </a>
      </div>

      {listing.priceEur !== null ? (
        <p className="mt-2 text-2xl font-semibold tracking-tight">
          {formatEur(listing.priceEur)}
        </p>
      ) : null}

      <div className="mt-3">
        <Riga etichetta="Titolo" dichiarato={listing.title} visto={identification.name} />
        <Riga etichetta="Marca" dichiarato={listing.brand} visto={identification.brand} />
        <Riga
          etichetta="Categoria"
          dichiarato={listing.category}
          visto={identification.objectType}
        />
        <Riga etichetta="Stato" dichiarato={listing.condition} visto={null} />
      </div>

      {marcaDiversa ? (
        <p className="mt-3 border-t-2 border-line pt-3 text-sm text-warn">
          La marca dichiarata e quella che vediamo nelle foto non coincidono. Guarda tu prima di
          fidarti di una delle due.
        </p>
      ) : null}

      {/* Se abbiamo cercato anche con le parole del venditore, si dice: e'
          l'unica parte della stima che poggia su quello che scrive lui. */}
      {usaLeSueParole ? (
        <p className="mt-3 border-t-2 border-line pt-3 text-xs text-muted">
          Dalle foto non abbiamo letto un modello, quindi abbiamo cercato anche con il titolo
          scritto dal venditore.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-muted">
        L’identificazione esce dalle foto dell’annuncio. Quello che c’e’ scritto nel testo non entra
        nella stima.
      </p>
    </Card>
  );
}
