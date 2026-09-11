import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card } from '@/components/ui';
import { getItemDetail } from '@/services/inventory/repository';
import { Authenticity } from '@/features/analyze/identity/Authenticity';
import { describeOutcome } from '@/services/inventory/outcome';
import { GenerateListing } from '@/features/listing/GenerateListing';
import { ArchiveToggle } from '@/features/inventory/ArchiveToggle';
import { LegacyItemDetail } from '@/features/inventory/LegacyItemDetail';
import { OutcomeTracker } from '@/features/inventory/OutcomeTracker';
import { ListingLink } from '@/features/analyze/ListingLink';
import { SavedAnalysis } from '@/features/inventory/SavedAnalysis';

export const dynamic = 'force-dynamic';

export default async function ItemPage({ params }: PageProps<'/inventario/[id]'>) {
  const { id } = await params;
  const result = await getItemDetail(id);

  // Un database irraggiungibile non e' un oggetto che non esiste: un 404 qui
  // direbbe "l'hai perso", quando invece e' solo Supabase che al momento non
  // risponde. `not_found` e `not_configured` restano 404, perche' in
  // entrambi i casi non c'e' niente da mostrare in questa pagina.
  if (result.status === 'unreachable') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
        <Link href="/inventario" className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          ← Inventario
        </Link>
        <Card className="mt-6 border-danger/40 bg-danger-soft">
          <p className="text-sm text-danger">
            Non riusciamo a raggiungere questo oggetto in questo momento. E’ ancora al sicuro:
            riprova fra poco.
          </p>
        </Card>
      </main>
    );
  }
  if (result.status !== 'ok') notFound();

  const { item, valuation, snapshot, comparables, imageUrls } = result.detail;

  const [cover, ...restImages] = imageUrls;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
      <Link href="/inventario" className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ← Inventario
      </Link>

      {/* La foto grande prima di tutto: e' l'oggetto, ed e' cio' che si
          riconosce prima di leggere qualsiasi parola. Le altre restano a
          fianco, piccole, invece di stare tutte in fila alte 128px. */}
      {cover ? (
        <div className="mt-5 overflow-hidden rounded-block border-2 border-line bg-surface-warm">
          <Image
            src={cover}
            alt=""
            width={800}
            height={600}
            unoptimized
            className="aspect-4/3 w-full object-cover"
          />
        </div>
      ) : null}

      {restImages.length > 0 ? (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {restImages.map((url) => (
            <Image
              key={url}
              src={url}
              alt=""
              width={200}
              height={200}
              unoptimized
              className="h-20 w-20 shrink-0 rounded-block border-2 border-line object-cover sm:h-24 sm:w-24"
            />
          ))}
        </div>
      ) : null}

      {snapshot ? (
        // L'analisi come e' uscita quel giorno, per intero: stesso ordine,
        // stesse prove, verdetto ricalcolato sul prezzo che stai digitando
        // adesso. `coverUrl` e' null perche' la foto grande sta gia' sopra —
        // la miniatura dell'intestazione sarebbe la terza copia della stessa
        // immagine.
        <SavedAnalysis
          itemId={item.id}
          snapshot={snapshot}
          coverUrl={null}
          initialAskingPrice={item.asking_price}
        />
      ) : (
        <LegacyItemDetail item={item} valuation={valuation} comparables={comparables} />
      )}

      <div className="mt-4 space-y-4">
        {/*
          Se l'oggetto veniva da un annuncio, la strada per tornarci sta qui.
          Prima si perdeva col salvataggio: la scheda del confronto vive nello
          stato del browser, e riaperto l'oggetto non restava niente. Ma
          «quella borsa e' ancora in vendita? a quanto sta adesso?» e' proprio
          la domanda di chi riapre, e va prima di «com'e' andata».
        */}
        <ListingLink
          listing={
            item.listing_url
              ? { url: item.listing_url, source: item.listing_source ?? 'vinted' }
              : null
          }
        />

        <OutcomeTracker item={item} outcome={describeOutcome(item, valuation)} />

        {/* Solo per le schede vecchie: con lo snapshot l'attribuzione e' gia'
            al suo posto, dentro le prove dell'identificazione. */}
        {snapshot ? null : <Authenticity authenticity={item.authenticity} />}

        <ArchiveToggle itemId={item.id} archived={item.archived_at !== null} />

        <GenerateListing itemId={item.id} />
      </div>
    </main>
  );
}
