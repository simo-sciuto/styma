import Image from 'next/image';
import Link from 'next/link';

import { Card, Pill } from '@/components/ui';
import { formatEur, formatRange } from '@/lib/format';
import { listInventory } from '@/services/inventory/repository';
import { ITEM_STATUS_LABELS } from '@/services/inventory/types';

export const metadata = { title: 'Inventario — STYMA' };
export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const result = await listInventory();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-20 pt-6">
      <h1 className="text-3xl font-semibold leading-[0.95] tracking-tighter">Inventario</h1>

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
        <ul className="mt-6 space-y-3">
          {result.entries.map(({ item, valuation, coverUrl }) => (
            <li key={item.id}>
              <Link
                href={`/inventario/${item.id}`}
                className="flex gap-4 rounded-block border border-line bg-surface p-4 transition hover:border-tile-teal hover:shadow-sm"
              >
                {coverUrl ? (
                  <Image
                    src={coverUrl}
                    alt=""
                    width={80}
                    height={80}
                    unoptimized
                    className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-2xl border border-dashed border-line" />
                )}

                <div className="min-w-0 flex-1">
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
