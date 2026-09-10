'use client';

import type { Economics, PriceThresholds, Valuation } from '@/schemas/analysis';
import { formatEur } from '@/lib/format';
import { Card } from '@/components/ui';
import { economicsAt } from '@/services/valuation/flip-score';

/**
 * Il conto. Uno solo, perche' e' sempre stato uno solo.
 *
 * La pagina lo stampava due volte, in due punti diversi e nella stessa forma
 * tipografica: dentro il blocco del verdetto la sottrazione che porta al
 * prezzo massimo, venti righe piu' giu' quella che porta al guadagno. Due
 * domande diverse — «fin dove posso pagarlo» e «quanto ci faccio a questo
 * prezzo» — ma lette una dopo l'altra sembravano lo stesso conto ripetuto,
 * il che e' peggio di entrambe: chi legge conclude che una delle due e'
 * sbagliata e smette di fidarsi del numero.
 *
 * Guardandole vicine si vede perche': le prime tre righe sono identiche.
 *
 *   valore atteso − commissioni − spedizione = quello che ti resta in mano
 *
 * Da li' in poi cambia solo cosa sottrai:
 *
 *   − quanto paghi                 → il tuo guadagno
 *   − il cuscinetto, poi diviso    → il prezzo massimo
 *
 * Quindi il tronco si scrive una volta e i due rami escono da li'. Non e'
 * un accorpamento grafico: e' l'aritmetica vera, che finalmente si vede.
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
  const restaInMano = breakdown.expectedSalePrice - breakdown.fees - breakdown.shipping;

  const pessimo = economics ? economicsAt(economics.purchasePrice, valuation.low) : null;
  const ottimo = economics ? economicsAt(economics.purchasePrice, valuation.high) : null;

  return (
    <Card>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Il conto</p>

      {/* Il tronco: le tre righe che valgono per tutte e due le domande. */}
      <dl className="mt-3 space-y-1.5 font-mono text-sm tabular-nums">
        <Row label="Lo rivendi a" value={formatEur(breakdown.expectedSalePrice, { precise: true })} />
        <Row label="− Commissioni" value={formatEur(breakdown.fees, { precise: true })} muted />
        <Row label="− Spedizione e imballo" value={formatEur(breakdown.shipping, { precise: true })} muted />
        <div className="flex items-baseline justify-between gap-3 border-t-2 border-line pt-1.5 font-semibold">
          <dt>Ti resta in mano</dt>
          <dd>{formatEur(restaInMano, { precise: true })}</dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-muted">
        Dentro questa cifra ci stanno sia quanto paghi l’oggetto sia quanto ci guadagni. Da qui in
        poi il conto si sdoppia, e le due strade partono dallo stesso numero.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Ramo 1: fin dove puoi spingerti. Esiste sempre, anche prima che
            qualcuno abbia digitato un prezzo — anzi soprattutto allora, ed
            e' il motivo per cui questo blocco non aspetta piu' l'input. */}
        <div className="rounded-block border-2 border-line bg-background p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Fin dove puoi pagarlo
          </p>
          <dl className="mt-2 space-y-1.5 font-mono text-sm tabular-nums">
            <Row
              label="− Tenuto da parte"
              value={formatEur(breakdown.riskBuffer, { precise: true })}
              muted
            />
            <Row label="− Il tuo guadagno" value={formatEur(breakdown.targetProfit, { precise: true })} muted />
            <div className="flex items-baseline justify-between gap-3 border-t-2 border-line pt-1.5 text-base font-semibold">
              <dt>Paga fino a</dt>
              <dd>{thresholds.buyUpTo !== null ? formatEur(thresholds.buyUpTo) : '—'}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">
            Il guadagno e’ meta’ di quello che spendi, sempre — che l’oggetto costi dieci euro o
            cinquecento. Quello che teniamo da parte invece cambia con quanto siamo sicuri: una
            stima fragile ti abbassa il massimo, cosi’ l’incertezza la paghi in trattativa e non
            dopo.
          </p>
        </div>

        {/* Ramo 2: cosa succede al prezzo che hai davanti. Senza un prezzo
            digitato il riquadro resta, vuoto e dichiarato: sparire farebbe
            saltare la pagina appena scrivi la prima cifra. */}
        <div className="rounded-block border-2 border-line bg-background p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            {economics ? `Se lo paghi ${formatEur(economics.purchasePrice)}` : 'Se lo paghi'}
          </p>

          {economics ? (
            <>
              <dl className="mt-2 space-y-1.5 font-mono text-sm tabular-nums">
                <Row
                  label="− Quello che spendi"
                  value={formatEur(economics.purchasePrice, { precise: true })}
                  muted
                />
                <div className="flex items-baseline justify-between gap-3 border-t-2 border-line pt-1.5 text-base font-semibold">
                  <dt>{economics.expectedProfit <= 0 ? 'Ci rimetti' : 'Ti resta'}</dt>
                  <dd className={economics.expectedProfit <= 0 ? 'text-danger' : ''}>
                    {economics.expectedProfit >= 0 ? '+' : ''}
                    {formatEur(economics.expectedProfit, { precise: true })}
                  </dd>
                </div>
                {economics.roi !== null ? (
                  <Row label="Su ogni euro speso" value={`+${Math.round(economics.roi * 100)}%`} muted />
                ) : null}
              </dl>

              {/* La stima e' una fascia, non un punto: un margine che regge
                  anche al minimo e' un'altra cosa rispetto a uno che esiste
                  solo vendendo al massimo. */}
              {pessimo && ottimo ? (
                <div className="mt-3 border-t-2 border-line pt-2 text-xs">
                  <p className="text-muted">
                    Se scendi a {formatEur(valuation.low)}:{' '}
                    <strong
                      className={`font-mono ${pessimo.expectedProfit > 0 ? 'text-accent' : 'text-danger'}`}
                    >
                      {pessimo.expectedProfit >= 0 ? '+' : ''}
                      {formatEur(pessimo.expectedProfit)}
                    </strong>
                  </p>
                  <p className="mt-0.5 text-muted">
                    Se trovi chi paga {formatEur(valuation.high)}:{' '}
                    <strong
                      className={`font-mono ${ottimo.expectedProfit > 0 ? 'text-accent' : 'text-danger'}`}
                    >
                      {ottimo.expectedProfit >= 0 ? '+' : ''}
                      {formatEur(ottimo.expectedProfit)}
                    </strong>
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Scrivi qui sopra quanto te lo chiedono e questo riquadro ti dice quanto ti resta.
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Commissioni e spedizione sono medie, non le tariffe del tuo marketplace: cambiano col peso,
        col servizio e con dove spedisci. Se lo vendi di persona, la spedizione non la paghi.
      </p>
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
