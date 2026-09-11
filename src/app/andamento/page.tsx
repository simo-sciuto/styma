import Link from 'next/link';

import { Card, PageHeader } from '@/components/ui';
import { CashflowChart } from '@/features/dashboard/CashflowChart';
import { RankingBars } from '@/features/dashboard/RankingBars';
import { formatEur } from '@/lib/format';
import { calibrate } from '@/services/inventory/calibration';
import { buildLedger } from '@/services/inventory/ledger';
import { listInventory } from '@/services/inventory/repository';
import { summarizeInventory } from '@/services/inventory/summary';

export const metadata = { title: 'Andamento · STYMA' };
export const dynamic = 'force-dynamic';

/**
 * Sto guadagnando?
 *
 * L'inventario risponde a «cosa ho», che e' una domanda diversa e piu' facile.
 * Questa pagina risponde all'unica che decide se vale la pena continuare, e la
 * risponde con i soldi veri: quelli che hai tirato fuori e quelli che hai
 * incassato, non le stime. Le stime stanno nell'inventario e sono previsioni;
 * qui non ne entra nessuna, perche' un cruscotto che mescola quello che e'
 * successo con quello che speri e' un cruscotto che non si puo' usare per
 * decidere niente.
 *
 * Nessuna query in piu': sono gli stessi oggetti che carica la lista.
 */
function Numero({
  label,
  value,
  hint,
  tone = 'plain',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'plain' | 'good' | 'bad';
}) {
  const colore = tone === 'good' ? 'text-accent' : tone === 'bad' ? 'text-danger' : '';
  return (
    <div>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${colore}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[0.7rem] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}

function Vuoto({ testo }: { testo: string }) {
  return (
    <Card className="mt-6">
      <p className="text-sm text-muted">{testo}</p>
      <Link
        href="/inventario"
        className="mt-3 inline-block text-sm font-medium underline decoration-line underline-offset-4"
      >
        Vai all’inventario
      </Link>
    </Card>
  );
}

export default async function AndamentoPage() {
  const result = await listInventory();

  if (result.status === 'not_configured') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
        <PageHeader title="Come sta andando" tone="terracotta" />
        <Vuoto testo="Inventario non configurato, quindi non c’e’ niente da contare." />
      </main>
    );
  }

  if (result.status === 'unreachable') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
        <PageHeader title="Come sta andando" tone="terracotta" />
        <Vuoto testo="Non riusciamo a leggere il magazzino. I dati sono al sicuro, riprova fra poco." />
      </main>
    );
  }

  const ledger = buildLedger(result.entries.map((entry) => entry.item));
  const calibration = calibrate(result.entries);
  const summary = summarizeInventory(result.entries);
  const { totals, months } = ledger;
  const inUtile = totals.marginEur >= 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
      <PageHeader
        title="Come sta andando"
        subtitle="Quello che e’ uscito e quello che e’ rientrato. Nessuna stima."
        tone="terracotta"
      />

      {months.length === 0 ? (
        <Vuoto
          testo="Non hai ancora registrato ne’ un acquisto ne’ una vendita. Appena dici quanto hai
          pagato un oggetto, qui comincia il conto."
        />
      ) : (
        <>
          {/* Livello 1: la risposta. Il margine e' l'unica cifra che risponde
              alla domanda con cui uno arriva qui. */}
          <section className="mt-6 rounded-block border-[3px] border-line bg-surface p-5 shadow-pop sm:p-6">
            <Numero
              label={inUtile ? 'Hai guadagnato' : 'Sei sotto di'}
              value={`${inUtile ? '+' : ''}${formatEur(totals.marginEur)}`}
              tone={inUtile ? 'good' : 'bad'}
              hint={
                totals.sold === 0
                  ? 'finche’ non vendi, il conto resta quello che hai speso'
                  : `su ${totals.sold} ${totals.sold === 1 ? 'vendita' : 'vendite'}, tolto tutto quello che hai speso`
              }
            />

            <div className="mt-5 grid grid-cols-2 gap-4 border-t-2 border-line pt-5">
              <Numero
                label="Incassato"
                value={formatEur(totals.earnedEur)}
                hint={`${totals.sold} ${totals.sold === 1 ? 'oggetto venduto' : 'oggetti venduti'}`}
              />
              <Numero
                label="Speso"
                value={formatEur(totals.spentEur)}
                hint={`${totals.bought} ${totals.bought === 1 ? 'oggetto comprato' : 'oggetti comprati'}`}
              />
            </div>
          </section>

          <Card className="mt-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
              Mese per mese
            </p>
            <div className="mt-3">
              <CashflowChart months={months} />
            </div>
          </Card>

          {/*
            «Sto guadagnando» ha una risposta sola e sta in cima. «Su cosa»
            e' la seconda domanda, ed e' quella che cambia cosa comprerai
            domenica prossima.
          */}
          {ledger.byCategory.length > 0 && totals.sold > 0 ? (
            <Card className="mt-4">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                Su cosa guadagni
              </p>
              <div className="mt-4">
                <RankingBars
                  rows={ledger.byCategory.slice(0, 6).map((riga) => ({
                    label: riga.category,
                    valueEur: riga.marginEur,
                    note: [
                      riga.sold > 0
                        ? `${riga.sold} ${riga.sold === 1 ? 'venduto' : 'venduti'}`
                        : 'nessuna vendita',
                      riga.inStock > 0 ? `${riga.inStock} in casa` : null,
                      riga.roi !== null ? `${Math.round(riga.roi * 100)}% su ${formatEur(riga.spentEur)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · '),
                  }))}
                />
              </div>
              <p className="mt-4 border-t-2 border-line pt-3 text-xs text-muted">
                Il margine conta solo i venduti. Su quello che hai ancora in casa non e’ ancora
                successo.
              </p>
            </Card>
          ) : null}

          {/*
            Quanti di quelli che compri escono davvero, e in quanto tempo.
            Per chi rivende il vincolo non e' il margine: e' la velocita' con
            cui il capitale torna libero.
          */}
          {ledger.sellThrough.rate !== null ? (
            <Card className="mt-4">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                Quanto gira
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <Numero
                  label="Venduti"
                  value={`${Math.round(ledger.sellThrough.rate * 100)}%`}
                  hint={`${ledger.sellThrough.sold} su ${ledger.sellThrough.bought} comprati`}
                />
                <Numero
                  label="Tempo medio"
                  value={
                    ledger.medianDaysToSell !== null ? `${ledger.medianDaysToSell} gg` : 'n.d.'
                  }
                  hint={
                    ledger.medianDaysToSell !== null
                      ? 'dall’acquisto alla vendita'
                      : 'nessuna vendita con una data d’acquisto'
                  }
                />
              </div>

              {/* La barra dice la stessa cosa del numero, e la dice a colpo
                  d'occhio: quanta parte del magazzino e' uscita. */}
              <div className="mt-4 flex h-4 overflow-hidden rounded-[0.3rem] border-2 border-line bg-background">
                <div
                  className="bg-verdict-buy"
                  style={{ width: `${ledger.sellThrough.rate * 100}%` }}
                />
              </div>
            </Card>
          ) : null}

          {/*
            Il capitale fermo non e' ne' un guadagno ne' una perdita, e per
            questo si legge male dentro il conto economico: e' il soldo che non
            puoi spendere di nuovo finche' non vendi. Per chi rivende e' il
            vincolo vero, e sta in un blocco suo.
          */}
          {ledger.itemsInStock > 0 ? (
            <Card className="mt-4">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                Fermo in magazzino
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <Numero
                  label="Capitale fermo"
                  value={formatEur(ledger.lockedUpEur)}
                  hint={`in ${ledger.itemsInStock} ${ledger.itemsInStock === 1 ? 'oggetto' : 'oggetti'} non ancora venduti`}
                />
                <Numero
                  label="Il piu’ vecchio"
                  value={
                    ledger.oldestInStockDays !== null
                      ? `${ledger.oldestInStockDays} gg`
                      : 'n.d.'
                  }
                  hint={
                    ledger.medianDaysToSell !== null
                      ? `di solito ne bastano ${ledger.medianDaysToSell} per venderne uno`
                      : 'nessuna vendita con cui confrontarlo'
                  }
                />
              </div>

              {/*
                Un solo numero di capitale fermo non distingue un magazzino
                che gira da un ripostiglio. Tre fasce si', e la terza e'
                quella da guardare.
              */}
              <ul className="mt-4 space-y-2 border-t-2 border-line pt-3">
                {ledger.aging.map((fascia, indice) => (
                  <li key={fascia.label} className="flex items-baseline gap-3">
                    <span className="w-32 shrink-0 text-xs text-muted">{fascia.label}</span>
                    <span className="flex h-3 flex-1 overflow-hidden rounded-[0.25rem] border-2 border-line bg-background">
                      <span
                        className={indice === 2 ? 'bg-verdict-pass' : 'bg-tile-teal'}
                        style={{
                          width: `${(fascia.items / Math.max(1, ledger.itemsInStock)) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums">
                      {fascia.items} · {formatEur(fascia.lockedEur)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/*
            Il numero che descrive te e non il mercato. Compare solo quando ha
            abbastanza vendite dietro: prima dice quante ne mancano, perche'
            una correzione costruita su due vendite convincerebbe piu' di
            quanto vale.
          */}
          <Card className="mt-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
              Il tuo metro
            </p>
            {calibration.enough ? (
              <>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {Math.round(calibration.ratio * 100)}% della stima
                </p>
                <p className="mt-1 text-sm text-muted">
                  Le tue {calibration.sales} vendite chiudono fra il{' '}
                  {Math.round(calibration.lowest * 100)}% e il{' '}
                  {Math.round(calibration.highest * 100)}%. Questa e’ la mediana.
                </p>
                <p className="mt-3 border-t-2 border-line pt-3 text-sm">
                  Da adesso ogni analisi ti mostra anche la stima al tuo metro.
                </p>
                {summary.checkedAgainstEstimate > 0 ? (
                  <p className="mt-2 text-sm text-muted">
                    {summary.insideEstimate} vendite su {summary.checkedAgainstEstimate} sono
                    finite dentro la fascia che avevamo dato.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Servono {calibration.needed} {calibration.needed === 1 ? 'vendita' : 'vendite'} in
                piu’. Poi ogni analisi ti dice anche quanto vale al tuo metro.
              </p>
            )}
          </Card>

          <Link
            href="/inventario"
            className="mt-6 text-center text-sm font-medium underline decoration-line underline-offset-4"
          >
            Vedi gli oggetti
          </Link>
        </>
      )}
    </main>
  );
}
