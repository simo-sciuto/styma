'use client';

import { Card } from '@/components/ui';

/**
 * L'attesa lunga, raccontata mentre accade.
 *
 * Un'analisi dura fra i trenta secondi e i due minuti: e' l'unico punto del
 * prodotto in cui si sta fermi a guardare lo schermo, e prima erano una frase
 * che sfarfallava in opacita' e un elenco di corsie.
 *
 * I tre passi sono quelli veri, e ognuno si accende quando comincia davvero e
 * si spunta quando finisce davvero — sono legati agli eventi che arrivano
 * dallo stream, non a un timer. Il passo in corso porta una barra
 * indeterminata, che va avanti e indietro apposta: non sappiamo quanto manca,
 * e una barra che si riempie fino al novanta per cento e li' si ferma sarebbe
 * la solita bugia comoda.
 *
 * Ogni passo, appena chiude, lascia dietro il suo risultato: il nome
 * dell'oggetto riconosciuto, quante inserzioni ha dato eBay. Chi aspetta vede
 * il lavoro accumularsi invece di una rotella.
 */

export type PassoStato = 'attesa' | 'corso' | 'fatto';

export type Passo = {
  titolo: string;
  /** Cosa si sta facendo, mentre e' in corso. */
  durante: string;
  /** Cosa e' venuto fuori, a passo concluso. Null finche' non si sa. */
  esito: string | null;
  stato: PassoStato;
};

/** Una corsia di ricerca vista da chi aspetta, quando la ricerca agentica e' accesa. */
export type Corsia = {
  id: string;
  label: string;
  status: 'running' | 'done' | 'failed';
  comparables: number;
};

function Segno({ stato }: { stato: PassoStato }) {
  if (stato === 'fatto') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-vivid text-accent-on-vivid">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m4 12.5 5.5 5.5L20 6.5" />
        </svg>
      </span>
    );
  }

  if (stato === 'corso') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-tile-teal">
        <span className="pending-dot h-2 w-2 rounded-full bg-tile-teal" />
      </span>
    );
  }

  return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-line" aria-hidden />;
}

function dettaglioCorsia(corsia: Corsia): string {
  if (corsia.status === 'running') return 'in corso…';
  if (corsia.status === 'failed') return 'non riuscita';
  if (corsia.comparables === 0) return 'niente di credibile';
  return corsia.comparables === 1 ? '1 comparabile' : `${corsia.comparables} comparabili`;
}

export function AnalysisProgress({ passi, corsie }: { passi: Passo[]; corsie: Corsia[] }) {
  const fatti = passi.filter((passo) => passo.stato === 'fatto').length;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Ci sto lavorando
        </p>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          {fatti} di {passi.length}
        </p>
      </div>

      <ol className="mt-4 space-y-4">
        {passi.map((passo, indice) => {
          const attivo = passo.stato === 'corso';
          return (
            <li key={passo.titolo} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Segno stato={passo.stato} />
                {/* Il filo che unisce i passi: si colora dietro a quelli
                    gia' fatti, cosi' il progresso si legge di lato senza
                    contare i segni. */}
                {indice < passi.length - 1 ? (
                  <span
                    aria-hidden
                    className={`mt-1 w-0.5 flex-1 rounded-full ${
                      passo.stato === 'fatto' ? 'bg-accent-vivid' : 'bg-line'
                    }`}
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <p
                  className={`text-sm font-medium ${
                    passo.stato === 'attesa' ? 'text-muted' : 'text-foreground'
                  }`}
                >
                  {passo.titolo}
                </p>

                {attivo ? (
                  <>
                    <p className="mt-0.5 text-sm text-muted">{passo.durante}</p>
                    <span
                      aria-hidden
                      className="indeterminate mt-2 block h-1 w-full rounded-full bg-line text-tile-teal"
                    />
                  </>
                ) : null}

                {passo.esito ? (
                  <p className="mt-0.5 text-sm text-muted">{passo.esito}</p>
                ) : null}

                {/* Le corsie stanno dentro il passo che le ha lanciate, non
                    in fondo alla scheda come un elenco a parte. */}
                {attivo && corsie.length > 0 ? (
                  <ul className="mt-2.5 space-y-1">
                    {corsie.map((corsia) => (
                      <li
                        key={corsia.id}
                        className="flex items-baseline justify-between gap-3 text-xs"
                      >
                        <span className={corsia.status === 'running' ? 'text-muted' : ''}>
                          {corsia.status === 'done' ? '✓' : corsia.status === 'failed' ? '×' : '·'}{' '}
                          {corsia.label}
                        </span>
                        <span
                          className={`shrink-0 ${
                            corsia.status === 'failed' ? 'text-danger' : 'text-muted'
                          }`}
                        >
                          {dettaglioCorsia(corsia)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 border-t-2 border-line pt-3 text-xs text-muted">
        Guardiamo annunci veri su cinque mercati. Ci mette il tempo che ci mette: nessuna barra che
        avanza da sola.
      </p>
    </Card>
  );
}
