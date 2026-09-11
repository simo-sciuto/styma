import type { MonthlyLedger } from '@/services/inventory/ledger';
import { formatEur } from '@/lib/format';

/**
 * Quello che entra sopra la riga, quello che esce sotto.
 *
 * Non e' una scelta grafica fra le tante: e' l'unica forma in cui un mese di
 * soli acquisti si legge per quello che e', cioe' soldi usciti e basta. Due
 * barre affiancate che salgono entrambe dal basso farebbero sembrare un mese
 * di sole spese un mese pieno di attivita'.
 *
 * Le due tinte sono quelle del verdetto, le stesse che dicono «compralo» e
 * «lascia stare» sulla pagina risultato: qui il verde e' denaro che rientra e
 * il rosso denaro che esce, ed e' la stessa direzione morale. Non ne servono
 * altre.
 *
 * SVG scritto a mano, nessuna libreria: sono barre su una scala lineare, e un
 * pacchetto da centinaia di kilobyte per disegnare dei rettangoli lo pagherebbe
 * chi apre la pagina da un telefono in giro.
 */

/** Altezza del disegno in unita' di viewBox. La larghezza la decide il CSS. */
const H = 100;
/** Spazio lasciato in alto e in basso perche' le barre non tocchino il bordo. */
const PAD = 6;

function etichettaMese(month: string): string {
  const [, mm] = month.split('-');
  return ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'][
    Number(mm) - 1
  ]!;
}

export function CashflowChart({ months }: { months: MonthlyLedger[] }) {
  if (months.length === 0) return null;

  /*
   * L'asse dello zero non sta a meta' altezza: sta dove lo mettono i dati.
   *
   * Fisso al centro, un magazzino che incassa 90 € e ne spende 25 disegnava
   * una barra verde grande e una rossa piccola con sotto meta' riquadro
   * vuoto, e le etichette dei mesi finivano lontanissime dalle barre che
   * nominano. Dividendo l'altezza fra i due massimi, il disegno riempie lo
   * spazio che ha e le due meta' restano confrontabili fra loro, perche' la
   * scala e' la stessa sopra e sotto.
   */
  const maxSopra = Math.max(0, ...months.map((m) => m.earnedEur));
  const maxSotto = Math.max(0, ...months.map((m) => m.spentEur));
  const picco = Math.max(1, maxSopra, maxSotto);
  const utile = H - 2 * PAD;
  const meta = PAD + (utile * maxSopra) / Math.max(1, maxSopra + maxSotto);
  const scala = (valore: number) => (valore / (maxSopra + maxSotto || 1)) * utile;

  const larghezzaColonna = 100 / months.length;
  // Le barre non riempiono la colonna: il vuoto fra un mese e l'altro e' quello
  // che rende contabile un istogramma a colpo d'occhio. Il tetto serve al caso
  // opposto, con uno o due mesi soli: senza, una barra larga mezzo schermo
  // sembrerebbe un blocco di colore invece che una misura.
  const larghezzaBarra = Math.min(larghezzaColonna * 0.55, 16);

  /*
   * La curva del cumulato vive su una scala sua, non su quella delle barre:
   * un totale che cresce di mese in mese schiaccerebbe le barre a niente se
   * condividessero l'asse, e le barre sono la lettura principale.
   */
  const cumulati = months.map((m) => m.cumulativeMarginEur);
  const cumMax = Math.max(...cumulati, 0);
  const cumMin = Math.min(...cumulati, 0);
  const cumSpan = cumMax - cumMin || 1;
  const linea =
    months.length < 2
      ? null
      : months
          .map((m, i) => {
            const x = i * larghezzaColonna + larghezzaColonna / 2;
            const y = H - PAD - ((m.cumulativeMarginEur - cumMin) / cumSpan) * (H - 2 * PAD);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(' ');

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${H}`}
        preserveAspectRatio="none"
        className="h-40 w-full sm:h-52"
        role="img"
        aria-label={`Incassi e spese per mese, da ${etichettaMese(months[0]!.month)} a ${etichettaMese(months[months.length - 1]!.month)}`}
      >
        {months.map((mese, indice) => {
          const centro = indice * larghezzaColonna + larghezzaColonna / 2;
          const x = centro - larghezzaBarra / 2;
          const su = scala(mese.earnedEur);
          const giu = scala(mese.spentEur);

          return (
            <g key={mese.month}>
              {mese.earnedEur > 0 ? (
                <rect
                  x={x}
                  y={meta - su}
                  width={larghezzaBarra}
                  height={su}
                  className="fill-verdict-buy stroke-line"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {mese.spentEur > 0 ? (
                <rect
                  x={x}
                  y={meta}
                  width={larghezzaBarra}
                  height={giu}
                  className="fill-verdict-pass stroke-line"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </g>
          );
        })}

        {/* La riga dello zero, sempre visibile anche dove non c'e' nessuna
            barra: e' il riferimento che rende leggibile il verso. */}
        <line
          x1={0}
          y1={meta}
          x2={100}
          y2={meta}
          className="stroke-line"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />

        {/*
          Il margine sommato da sempre, sopra le barre.
          La domanda vera non e' «come e' andato marzo» ma «sto andando avanti
          o indietro», e le barre mensili da sole non la distinguono: un mese
          storto dentro una curva che sale e' un mese storto, lo stesso mese
          dentro una curva che scende e' un problema.
          Passa da due mesi in su: con un mese solo non e' una curva, e' un
          punto.
        */}
        {linea ? (
          <polyline
            points={linea}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      {/* Le etichette stanno fuori dall'SVG: dentro, con
          `preserveAspectRatio="none"`, il testo verrebbe stirato con le
          barre. */}
      <div className="mt-1.5 flex" aria-hidden>
        {months.map((mese) => (
          <span
            key={mese.month}
            className="min-w-0 flex-1 text-center font-mono text-[0.6rem] uppercase text-muted"
          >
            {months.length <= 12 ? etichettaMese(mese.month) : ''}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-[0.15rem] border-2 border-line bg-verdict-buy"
          />
          Incassato
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-[0.15rem] border-2 border-line bg-verdict-pass"
          />
          Speso
        </span>
        {/* La curva non ha assi, quindi il suo valore finale va scritto:
            senza, si legge la forma e non si legge la cifra. */}
        {linea ? (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 shrink-0 bg-foreground" />
            Totale da sempre{' '}
            <strong className="font-mono text-foreground">
              {cumulati[cumulati.length - 1]! >= 0 ? '+' : ''}
              {formatEur(cumulati[cumulati.length - 1]!)}
            </strong>
          </span>
        ) : null}
        <span className="font-mono">picco {formatEur(picco)}</span>
      </div>
    </div>
  );
}
