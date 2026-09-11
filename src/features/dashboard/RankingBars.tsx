import { formatEur } from '@/lib/format';

/**
 * Una classifica, non un grafico a torta.
 *
 * La domanda e' «su cosa guadagno», e ha una risposta ordinata: la categoria
 * che rende di piu', poi la seconda, poi quella che ti sta facendo perdere
 * soldi. Una torta obbliga a confrontare angoli, e non sa disegnare un
 * negativo — che qui e' proprio la fetta da guardare per prima.
 *
 * Le barre partono dal centro quando c'e' almeno una categoria in perdita, e
 * da sinistra quando sono tutte in attivo: uno zero che si sposta a seconda
 * dei dati e' meno elegante di un asse fisso, e molto piu' leggibile.
 */
export type RankingRow = {
  label: string;
  valueEur: number;
  /** Riga piccola sotto l'etichetta: quanti pezzi, che ritorno. */
  note: string;
};

export function RankingBars({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) return null;

  const massimo = Math.max(1, ...rows.map((row) => Math.abs(row.valueEur)));
  const inPerdita = rows.some((row) => row.valueEur < 0);

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const quota = Math.abs(row.valueEur) / massimo;
        const negativo = row.valueEur < 0;

        return (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-semibold first-letter:uppercase">
                {row.label}
              </span>
              <span
                className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                  negativo ? 'text-danger' : ''
                }`}
              >
                {row.valueEur > 0 ? '+' : ''}
                {formatEur(row.valueEur)}
              </span>
            </div>

            {/* La traccia e' sempre a tutta larghezza: senza, barre corte
                sembrerebbero incomplete invece che piccole. Quando c'e' una
                categoria in perdita la traccia si divide in due meta' e lo
                zero sta in mezzo, cosi' il rosso cresce verso sinistra come
                ci si aspetta. */}
            <div className="mt-1 flex h-4 overflow-hidden rounded-[0.3rem] border-2 border-line bg-background">
              {inPerdita ? (
                <div className="flex w-1/2 justify-end border-r-2 border-line">
                  {negativo ? (
                    <div className="bg-verdict-pass" style={{ width: `${quota * 100}%` }} />
                  ) : null}
                </div>
              ) : null}
              <div className={inPerdita ? 'flex w-1/2' : 'flex w-full'}>
                {negativo ? null : (
                  <div className="bg-verdict-buy" style={{ width: `${quota * 100}%` }} />
                )}
              </div>
            </div>

            <p className="mt-0.5 text-xs text-muted">{row.note}</p>
          </li>
        );
      })}
    </ul>
  );
}
