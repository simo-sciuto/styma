import Image from 'next/image';
import Link from 'next/link';

import { Card, PageHeader, Pill } from '@/components/ui';
import { formatEur, formatRange } from '@/lib/format';
import { listInventory } from '@/services/inventory/repository';
import { InventoryFilters } from '@/features/inventory/InventoryFilters';
import { DeleteItem } from '@/features/inventory/DeleteItem';
import { ITEM_STATUS_LABELS, type ItemRow } from '@/services/inventory/types';

/**
 * Il prezzo che vale la pena mostrare in lista dipende da dove sei arrivato
 * con quell'oggetto: prima conta quanto chiedono, poi quanto hai pagato,
 * alla fine quanto hai incassato.
 */
function priceNote(item: ItemRow): string | null {
  if (item.status === 'sold' && item.sale_price !== null) {
    return `Venduto a ${formatEur(item.sale_price)}`;
  }
  if (item.purchase_price !== null) return `Pagato ${formatEur(item.purchase_price)}`;
  if (item.asking_price !== null) return `Chiedevano ${formatEur(item.asking_price)}`;
  return null;
}

export const metadata = { title: 'Inventario · STYMA' };
export const dynamic = 'force-dynamic';

export default async function InventoryPage({ searchParams }: PageProps<'/inventario'>) {
  const params = await searchParams;
  const showArchived = params.archiviati === '1';
  const result = await listInventory(showArchived);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
      <PageHeader title="Inventario" subtitle="Ogni oggetto che hai analizzato." />

      {result.status === 'not_configured' ? (
        <Card className="mt-6">
          <p className="text-sm">
            Inventario non configurato, manca la connessione a Supabase. L’analisi funziona
            comunque.
          </p>
        </Card>
      ) : result.status === 'unreachable' ? (
        // Diverso apposta dal caso "vuoto": un database irraggiungibile non e'
        // un inventario senza oggetti, e dirlo con le stesse parole farebbe
        // credere a chi ha gia' salvato qualcosa di averlo perso.
        <Card className="mt-6 border-danger/40 bg-danger-soft">
          <p className="text-sm text-danger">
            Non riusciamo a raggiungere l’inventario. I tuoi oggetti sono al sicuro, riprova fra
            poco.
          </p>
        </Card>
      ) : result.entries.length === 0 ? (
        <Card className="mt-6">
          {/* Una lista vuota con degli archiviati dentro non e' un inventario
              vuoto, ed e' l'unico punto della pagina da cui si potrebbe
              restare senza una strada per tornare a prenderli. */}
          {result.archived > 0 ? (
            <p className="text-sm text-muted">
              Niente in lista:{' '}
              {result.archived === 1
                ? 'l’unico oggetto che hai e’ archiviato'
                : `i tuoi ${result.archived} oggetti sono tutti archiviati`}
              .{' '}
              <Link
                href="/inventario?archiviati=1"
                className="underline decoration-line underline-offset-4"
              >
                Mostrali
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted">
              Ancora niente. Analizza un oggetto e lo ritrovi qui, con la stima che aveva quel
              giorno.
            </p>
          )}
        </Card>
      ) : (
        <>
          {result.archived > 0 ? (
            // Nasconderli senza dire quanti sono farebbe sparire oggetti
            // senza che nessuno sappia dove sono finiti.
            <p className="mt-4 text-sm text-muted">
              {showArchived
                ? `Compresi ${result.archived} archiviati. `
                : `${result.archived} ${result.archived === 1 ? 'oggetto archiviato' : 'oggetti archiviati'}, fuori da questa lista. `}
              <Link
                href={showArchived ? '/inventario' : '/inventario?archiviati=1'}
                className="underline decoration-line underline-offset-4"
              >
                {showArchived ? 'Nascondili' : 'Mostrali'}
              </Link>
            </p>
          ) : null}

          {/*
            Cercare, al posto dei totali. In cima c'era il cruscotto in
            miniatura: gli stessi numeri di `/andamento`, detti peggio perche'
            senza il tempo, sulla meta' alta di una pagina che serve a trovare
            un oggetto fra quaranta.

            E le schede arrivano gia' rese, non come una funzione.
            La prima versione passava un render-prop — `children` come
            funzione — e in React una funzione non attraversa il confine fra
            server e client: «Functions are not valid as a child of Client
            Components», e la lista spariva. Un nodo gia' reso invece viaggia,
            perche' e' dato. Il filtro sceglie quali mostrare, non come sono
            fatti: le foto e i link restano lavoro del server.
          */}
          <InventoryFilters
            items={result.entries.map(({ item, valuation, coverUrl }) => ({
              id: item.id,
              title: item.title,
              brand: item.brand,
              category: item.category,
              status: item.status,
              scheda: (
                // min-w-0: un elemento di griglia ha min-width:auto, e il titolo
                // con `truncate` (white-space:nowrap) contribuisce con la sua
                // larghezza intera. Con un titolo lungo la traccia diventava piu'
                // larga della colonna e la pagina sbordava di lato sul telefono.
                // `relative`: la crocetta sta sopra la scheda in un angolo, e
                // deve restare fuori dal <Link> che la avvolge — un bottone
                // dentro un collegamento non e' HTML valido.
                <li key={item.id} className="relative min-w-0">
                  <DeleteItem itemId={item.id} title={item.title} />
                  {/* Riga compatta sul telefono, scheda con foto grande da sm in
                    su. Una card 4:3 a tutta larghezza e' alta ~360px: su uno
                    schermo da 667px se ne vedevano meno di due, e un inventario
                    si scorre per trovare qualcosa, non si contempla. */}
                  <Link
                    href={`/inventario/${item.id}`}
                    className="group flex gap-3 overflow-hidden rounded-block border-2 border-line bg-surface p-3 transition-shadow hover:shadow-pop-sm sm:block sm:p-0"
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
                        {[item.brand, item.estimated_period].filter(Boolean).join(' · ') ||
                          item.category}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {valuation?.low_value !== null && valuation?.high_value != null ? (
                          <Pill tone="accent">
                            {formatRange(valuation.low_value!, valuation.high_value)}
                          </Pill>
                        ) : (
                          <Pill tone="warn">Valore non stimato</Pill>
                        )}
                        <Pill tone={item.status === 'sold' ? 'accent' : 'neutral'}>
                          {ITEM_STATUS_LABELS[item.status]}
                        </Pill>
                        {item.archived_at !== null ? <Pill>Archiviato</Pill> : null}
                        {/* Il prezzo che conta cambia col punto in cui sei: al
                          banco quanto chiedono, in magazzino quanto hai
                          pagato, dopo quanto hai incassato. Uno alla volta:
                          sul telefono la seconda pillola ruberebbe la riga
                          alla fascia. */}
                        {priceNote(item) ? (
                          <span className="hidden sm:inline-flex">
                            <Pill>{priceNote(item)}</Pill>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              ),
            }))}
          />
        </>
      )}
    </main>
  );
}
