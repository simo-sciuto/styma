import Image from 'next/image';
import Link from 'next/link';

import { Card, PageHeader, Pill } from '@/components/ui';
import { formatEur, formatRange } from '@/lib/format';
import { listInventory } from '@/services/inventory/repository';
import { ITEM_STATUS_LABELS } from '@/services/inventory/types';

export const metadata = { title: 'Inventario — STYMA' };
export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const result = await listInventory();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
      <PageHeader
        title="Inventario"
        subtitle="Ogni oggetto con la valutazione che aveva il giorno in cui l’hai salvato."
      />

      {result.status === 'not_configured' ? (
        <Card className="mt-6">
          <p className="text-sm">
            L’inventario non e’ configurato: manca la connessione a Supabase. L’analisi funziona
            comunque.
          </p>
        </Card>
      ) : result.status === 'unreachable' ? (
        // Diverso apposta dal caso "vuoto": un database irraggiungibile non e'
        // un inventario senza oggetti, e dirlo con le stesse parole farebbe
        // credere a chi ha gia' salvato qualcosa di averlo perso.
        <Card className="mt-6 border-danger/40 bg-danger-soft">
          <p className="text-sm text-danger">
            Non riusciamo a raggiungere l’inventario in questo momento. I tuoi oggetti sono al
            sicuro: riprova fra poco.
          </p>
        </Card>
      ) : result.entries.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-muted">
            Ancora niente qui. Analizza un oggetto e salvalo: lo ritrovi in questa pagina con la
            valutazione che aveva quel giorno.
          </p>
        </Card>
      ) : (
        // Da riga a card immagine-avanti: una collezione di oggetti si
        // scorre con gli occhi sulla foto, non sul testo — l'oggetto e'
        // sempre la prima cosa che si riconosce, in un mercatino vero.
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {result.entries.map(({ item, valuation, coverUrl }) => (
            <li key={item.id}>
              <Link
                href={`/inventario/${item.id}`}
                className="group block overflow-hidden rounded-block border border-line bg-surface transition hover:border-tile-teal hover:shadow-sm"
              >
                <div className="aspect-4/3 overflow-hidden bg-surface-warm">
                  {coverUrl ? (
                    <Image
                      src={coverUrl}
                      alt=""
                      width={400}
                      height={300}
                      unoptimized
                      className="h-full w-full object-cover transition duration-[600ms] ease-out group-hover:scale-105 group-hover:rotate-1"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                      Nessuna foto
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {[item.brand, item.estimated_period].filter(Boolean).join(' · ') || item.category}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill>{ITEM_STATUS_LABELS[item.status]}</Pill>
                    {item.purchase_price !== null ? (
                      <Pill>Pagato {formatEur(item.purchase_price)}</Pill>
                    ) : null}
                    {valuation?.low_value !== null && valuation?.high_value != null ? (
                      <Pill tone="accent">
                        {formatRange(valuation.low_value!, valuation.high_value)}
                      </Pill>
                    ) : (
                      <Pill tone="warn">Valore non stimato</Pill>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
