'use client';

import type { Economics, PriceThresholds, Valuation } from '@/schemas/analysis';
import { formatEur } from '@/lib/format';
import { Card } from '@/components/ui';
import { economicsAt } from '@/services/valuation/flip-score';

/**
 * Da quanto lo rivendi a quanto puoi pagarlo, in una colonna sola.
 *
 * Due versioni precedenti, due difetti opposti. La prima stampava il conto due
 * volte in due punti della pagina, e chi leggeva concludeva che una delle due
 * sbagliava. La seconda le univa ma le apriva in due riquadri affiancati con
 * un numero intermedio in mezzo, «ti resta in mano 103,50», e una frase che
 * spiegava che da li' il conto si sdoppiava: corretta, e illeggibile.
 *
 * Il numero intermedio era il problema. Non e' una cosa che esista per chi
 * compra: e' un passaggio dell'aritmetica, e stamparlo in grassetto obbliga a
 * fermarsi a capire cosa sia. Qui la colonna scende dritta fino all'unico
 * numero che si porta al banco, e il prezzo digitato e' una riga sotto.
 */
export function Ledger({
  thresholds,
  economics,
  valuation,
}: {
  thresholds: PriceThresholds;
  /** Presente solo quando un prezzo e' stato digitato. */
  economics: Economics | null;
  valuation: Extract<Valuation, { available: true }>;
}) {
  const { breakdown } = thresholds;
  const pessimo = economics ? economicsAt(economics.purchasePrice, valuation.low) : null;
  const ottimo = economics ? economicsAt(economics.purchasePrice, valuation.high) : null;

  /*
   * Il cuscinetto di rischio e il guadagno obiettivo stavano su due righe.
   * Erano due righe vere, e una di troppo: «margine di sicurezza» e' un
   * concetto contabile che obbliga a fermarsi, e chi legge sta in piedi
   * davanti a un banco. Sommati fanno una riga sola che l'aritmetica continua
   * a far tornare fino all'ultimo centesimo, e il prezzo massimo non cambia
   * di un euro.
   *
   * Sommati, non tolti: e' il cuscinetto la sola parte di questo conto che
   * dipende da quanto siamo sicuri, ed e' cosi' che una stima fragile abbassa
   * il prezzo massimo invece di scaricare il rischio su chi compra. Toglierlo
   * davvero avrebbe dato lo stesso massimo a una stima solida e a una tirata
   * fuori da tre annunci.
   */
  const margine = breakdown.riskBuffer + breakdown.targetProfit;

  return (
    <Card>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Il conto</p>

      <dl className="mt-3 space-y-1.5 font-mono text-sm tabular-nums">
        <Row label="Lo rivendi a" value={formatEur(breakdown.expectedSalePrice, { precise: true })} />
        <Row label="Il tuo margine" value={`− ${formatEur(margine, { precise: true })}`} muted />
        <div className="flex items-baseline justify-between gap-3 border-t-2 border-line pt-2 text-lg font-semibold">
          <dt>Paga fino a</dt>
          <dd>{thresholds.buyUpTo !== null ? formatEur(thresholds.buyUpTo) : 'n.d.'}</dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-muted">
        Piu’ la stima e’ incerta, piu’ margine teniamo da parte.
      </p>

      {/*
        Il prezzo digitato: una riga, non un secondo conto. Le due cifre agli
        estremi della fascia non sono decorazione: un margine che regge anche
        vendendo al minimo e' un'altra cosa rispetto a uno che esiste solo se
        trovi chi paga il massimo.
      */}
      {economics && pessimo && ottimo ? (
        <div className="mt-4 rounded-block border-2 border-line bg-background p-4">
          <p className="text-sm">
            A <strong>{formatEur(economics.purchasePrice)}</strong> ti{' '}
            {economics.expectedProfit <= 0 ? 'costa' : 'restano'}{' '}
            <strong
              className={`font-mono ${economics.expectedProfit <= 0 ? 'text-danger' : 'text-accent'}`}
            >
              {economics.expectedProfit >= 0 ? '+' : ''}
              {formatEur(economics.expectedProfit, { precise: true })}
            </strong>
            {economics.roi !== null ? (
              <span className="text-muted"> ({Math.round(economics.roi * 100)}% di ritorno)</span>
            ) : null}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            Vendendolo a {formatEur(valuation.low)}:{' '}
            <span className={`font-mono ${pessimo.expectedProfit > 0 ? 'text-accent' : 'text-danger'}`}>
              {pessimo.expectedProfit >= 0 ? '+' : ''}
              {formatEur(pessimo.expectedProfit)}
            </span>
            {'. '}A {formatEur(valuation.high)}:{' '}
            <span className={`font-mono ${ottimo.expectedProfit > 0 ? 'text-accent' : 'text-danger'}`}>
              {ottimo.expectedProfit >= 0 ? '+' : ''}
              {formatEur(ottimo.expectedProfit)}
            </span>
            .
          </p>
        </div>
      ) : null}
    </Card>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${muted ? 'text-muted' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
