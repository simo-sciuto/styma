'use client';

import type { Economics, Valuation } from '@/schemas/analysis';
import { formatEur } from '@/lib/format';
import { Card } from '@/components/ui';
import { economicsAt } from '@/services/valuation/flip-score';

function Row({
  label,
  value,
  tone = 'plain',
}: {
  label: string;
  value: string;
  tone?: 'plain' | 'cost' | 'total';
}) {
  const styles = {
    plain: 'text-foreground',
    cost: 'text-muted',
    total: 'text-foreground font-semibold',
  } as const;

  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${
        tone === 'total' ? 'border-t border-line pt-2' : ''
      }`}
    >
      <dt className={tone === 'cost' ? 'text-muted' : ''}>{label}</dt>
      <dd className={`font-mono tabular-nums ${styles[tone]}`}>{value}</dd>
    </div>
  );
}

/**
 * Il conto, come lo farebbe chi rivende: quanto esce, quanto entra, cosa
 * resta.
 *
 * Prima erano quattro celle in fondo alla card del punteggio, con "margine
 * atteso" come etichetta di un numero che nessuno aveva visto nascere. Qui si
 * legge dall'alto in basso e si controlla a mente.
 *
 * Le due righe agli estremi della fascia non sono decorazione: la stima e' un
 * intervallo, e un margine che regge al minimo e' un'altra cosa rispetto a uno
 * che esiste solo se vendi al massimo.
 */
export function FlipEconomics({
  economics,
  valuation,
}: {
  economics: Economics;
  valuation: Extract<Valuation, { available: true }>;
}) {
  const { purchasePrice, expectedSalePrice, marketplaceFees, shipping, expectedProfit, roi } =
    economics;

  const pessimo = economicsAt(purchasePrice, valuation.low);
  const ottimo = economicsAt(purchasePrice, valuation.high);
  const inPerdita = expectedProfit <= 0;

  return (
    <Card>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
        Se lo prendi a {formatEur(purchasePrice)}
      </p>

      <dl className="mt-3 space-y-2 text-sm">
        <Row label="Lo rivendi a" value={formatEur(expectedSalePrice)} />
        <Row label="− Commissioni" value={formatEur(marketplaceFees, { precise: true })} tone="cost" />
        <Row label="− Spedizione e imballo" value={formatEur(shipping)} tone="cost" />
        <Row label="− Quello che hai speso" value={formatEur(purchasePrice)} tone="cost" />
        <Row
          label={inPerdita ? 'Ci rimetti' : 'Ti resta'}
          value={`${expectedProfit >= 0 ? '+' : ''}${formatEur(expectedProfit, { precise: true })}`}
          tone="total"
        />
        {roi !== null ? (
          <Row label="Su ogni euro speso" value={`+${Math.round(roi * 100)}%`} tone="cost" />
        ) : null}
      </dl>

      {/* La stima e' una fascia, non un punto: un margine che regge anche al
          minimo e' un'altra cosa rispetto a uno che esiste solo vendendo al
          massimo. Qui si vede quale dei due casi e'. */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Se scendi a {formatEur(valuation.low)}
          </p>
          <p
            className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
              pessimo.expectedProfit > 0 ? 'text-accent' : 'text-danger'
            }`}
          >
            {pessimo.expectedProfit >= 0 ? '+' : ''}
            {formatEur(pessimo.expectedProfit)}
          </p>
        </div>
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Se trovi chi paga {formatEur(valuation.high)}
          </p>
          <p
            className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
              ottimo.expectedProfit > 0 ? 'text-accent' : 'text-danger'
            }`}
          >
            {ottimo.expectedProfit >= 0 ? '+' : ''}
            {formatEur(ottimo.expectedProfit)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Commissioni e spedizione sono medie, non le tariffe del tuo marketplace: cambiano col peso,
        col servizio e con dove spedisci. Se lo vendi di persona, la spedizione non la paghi.
      </p>
    </Card>
  );
}
