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
            // min-w-0: un elemento di griglia ha min-width:auto, e il titolo
            // con `truncate` (white-space:nowrap) contribuisce con la sua
            // larghezza intera. Con un titolo lungo la traccia diventava piu'
            // larga della colonna e la pagina sbordava di lato sul telefono.
            <li key={item.id} className="min-w-0">
              {/* Riga compatta sul telefono, scheda con foto grande da sm in
                  su. Una card 4:3 a tutta larghezza e' alta ~360px: su uno
                  schermo da 667px se ne vedevano meno di due, e un inventario
                  si scorre per trovare qualcosa, non si contempla. */}
              <Link
                href={`/inventario/${item.id}`}
                className="group flex gap-3 overflow-hidden rounded-block border border-line bg-surface p-3 transition hover:border-tile-teal hover:shadow-sm sm:block sm:p-0"
              >
                <div className="aspect-square w-24 shrink-0 overflow-hidden rounded-xl bg-surface-warm sm:aspect-4/3 sm:w-full sm:rounded-none">
                  {coverUrl ? (
                    <Image
                      src={coverUrl}
                      alt=""
                      width={400}
                      height={300}
                      unoptimized
                      className="h-full w-full object-cover transition duration-600 ease-out group-hover:scale-105 sm:group-hover:rotate-1"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted">
                      Nessuna foto
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center sm:block sm:p-4">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {[item.brand, item.estimated_period].filter(Boolean).join(' · ') || item.category}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {valuation?.low_value !== null && valuation?.high_value != null ? (
                      <Pill tone="accent">
                        {formatRange(valuation.low_value!, valuation.high_value)}
                      </Pill>
                    ) : (
                      <Pill tone="warn">Valore non stimato</Pill>
                    )}
                    <Pill>{ITEM_STATUS_LABELS[item.status]}</Pill>
                    {/* Quanto e' costato serve quando confronti, non quando
                        cerchi: sul telefono ruberebbe la riga al valore. */}
                    {item.purchase_price !== null ? (
                      <span className="hidden sm:inline-flex">
                        <Pill>Pagato {formatEur(item.purchase_price)}</Pill>
                      </span>
                    ) : null}
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
