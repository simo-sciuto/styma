import Image from 'next/image';
import Link from 'next/link';

import { Card, PageHeader, Pill } from '@/components/ui';
import { summarizeInventory, type InventorySummary } from '@/services/inventory/summary';
import { formatEur, formatRange } from '@/lib/format';
import { listInventory } from '@/services/inventory/repository';
import { ITEM_STATUS_LABELS, type ItemRow } from '@/services/inventory/types';

/**
 * Un dato mancante si dichiara invece di diventare uno zero: "non hai
 * registrato spese" e "hai speso 0 €" sono due cose diverse, e la seconda
 * e' quella che farebbe sembrare gratis un magazzino pieno.
 */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      {hint ? <p className="mt-0.5 text-[0.7rem] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}

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

function InventorySummaryBlock({ summary }: { summary: InventorySummary }) {
  const {
    items,
    valued,
    estimatedValueEur,
    bought,
    spentEur,
    withBoth,
    potentialMarginEur,
    sold,
    soldWithBoth,
    realizedMarginEur,
    checkedAgainstEstimate,
    insideEstimate,
  } = summary;

  return (
    <div className="mt-6 rounded-block bg-surface-warm p-5 sm:p-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Oggetti" value={String(items)} />
        <Stat
          label="Valore stimato"
          value={estimatedValueEur !== null ? formatEur(estimatedValueEur) : '—'}
          hint={valued < items ? `su ${valued} di ${items} stimati` : undefined}
        />
        <Stat
          label="Speso"
          value={spentEur !== null ? formatEur(spentEur) : '—'}
          hint={bought < items ? `su ${bought} comprati davvero` : undefined}
        />
        <Stat
          label="Margine atteso"
          value={potentialMarginEur !== null ? formatEur(potentialMarginEur) : '—'}
          hint={
            withBoth > 0
              ? `su ${withBoth} ${withBoth === 1 ? 'oggetto' : 'oggetti'} ancora in mano, al netto di commissioni e spedizione`
              : 'serve sia il prezzo pagato sia una stima'
          }
        />
      </div>

      {/* La riga dei fatti, separata da quella delle previsioni: sopra c'e'
          quello che pensiamo, qui sotto quello che e' successo. Compare solo
          quando c'e' almeno una vendita — quattro trattini non sono un
          cruscotto, sono un rimprovero. */}
      {sold > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-4 border-t-2 border-line pt-5">
          <Stat
            label="Guadagnato davvero"
            value={realizedMarginEur !== null ? formatEur(realizedMarginEur) : '—'}
            hint={
              soldWithBoth > 0
                ? `su ${soldWithBoth} ${soldWithBoth === 1 ? 'vendita' : 'vendite'} di cui sai anche quanto avevi pagato`
                : 'serve anche il prezzo pagato'
            }
          />
          <Stat
            label="Stime centrate"
            value={
              checkedAgainstEstimate > 0 ? `${insideEstimate}/${checkedAgainstEstimate}` : '—'
            }
            hint={
              checkedAgainstEstimate > 0
                ? 'vendite finite dentro la fascia che avevamo dato'
                : 'nessuna vendita confrontabile con una stima'
            }
          />
        </div>
      ) : null}
    </div>
  );
}

export const metadata = { title: 'Inventario — STYMA' };
export const dynamic = 'force-dynamic';

export default async function InventoryPage({ searchParams }: PageProps<'/inventario'>) {
  const params = await searchParams;
  const showArchived = params.archiviati === '1';
  const result = await listInventory(showArchived);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
      <PageHeader
        title="Inventario"
        subtitle="Ogni oggetto che hai analizzato, con la valutazione che aveva quel giorno e com’e’ andata a finire."
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
              <Link href="/inventario?archiviati=1" className="underline decoration-line underline-offset-4">
                Mostrali
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted">
              Ancora niente qui. Analizza un oggetto: si salva da solo e lo ritrovi in questa
              pagina, con la valutazione che aveva quel giorno.
            </p>
          )}
        </Card>
      ) : (
        <>
          {/* Il magazzino a colpo d'occhio, prima della lista: quanto vale,
              quanto e' costato, quanto ci puoi guadagnare. Dati gia' caricati
              per la lista, nessuna query in piu'. */}
          <InventorySummaryBlock summary={summarizeInventory(result.entries)} />

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

          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
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
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
