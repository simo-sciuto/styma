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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
      <Link href="/inventario" className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ← Inventario
      </Link>

      {snapshot ? (
        // L'analisi come e' uscita quel giorno, per intero: stesso ordine,
        // stesse prove, stesse foto nello stesso posto, verdetto ricalcolato
        // sul prezzo che stai digitando adesso. La foto grande che stava
        // sopra e' sparita: era l'unica differenza di impaginazione fra
        // questa pagina e quella dell'analisi appena fatta, e chi passava
        // dall'una all'altra doveva ritrovarsi. Ora la miniatura si apre
        // grande con un tocco, che e' anche meglio di una foto fissa.
        <SavedAnalysis
          itemId={item.id}
          snapshot={snapshot}
          photoUrls={imageUrls}
          initialAskingPrice={item.asking_price}
          listing={
            item.listing_url
              ? { url: item.listing_url, source: item.listing_source ?? 'vinted' }
              : null
          }
        />
      ) : (
        <LegacyItemDetail item={item} valuation={valuation} comparables={comparables} />
      )}

      <div className="mt-4 space-y-4">
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
