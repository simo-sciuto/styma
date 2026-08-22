'use client';

import type { ReactNode } from 'react';

import type {
  AnalysisResult,
  MarketSource,
  Recommendation,
  WeightedComparable,
} from '@/schemas/analysis';
import { Card, Disclosure, Pill } from '@/components/ui';
import {
  CONDITION_LABELS,
  CONFIDENCE_LABELS,
  DEMAND_LABELS,
  LIQUIDITY_LABELS,
  MATCH_LABELS,
  formatDate,
  formatEur,
  formatRange,
} from '@/lib/format';

/**
 * L'eta' della ricerca si dichiara sempre, anche quando e' di oggi. Chi decide
 * davanti a un banco deve sapere se sta guardando il mercato di adesso o quello
 * di tre settimane fa: nasconderlo sarebbe far sembrare fresco un dato riusato.
 */
function describeMarketSource(source: MarketSource): string {
  if (!source.cached) return 'Ricerca fatta adesso, su vendite e annunci reali.';
  if (source.ageDays === 0) return 'Ricerca riusata, fatta oggi per lo stesso modello.';
  if (source.ageDays === 1) return 'Ricerca riusata, fatta ieri per lo stesso modello.';
  return `Ricerca riusata, fatta ${source.ageDays} giorni fa per lo stesso modello.`;
}

const RECOMMENDATION_STYLES: Record<Recommendation, { tone: string; label: string }> = {
  BUY: { tone: 'bg-accent-soft text-accent', label: 'Compralo' },
  MAYBE: { tone: 'bg-warn-soft text-warn', label: 'Forse' },
  PASS: { tone: 'bg-danger-soft text-danger', label: 'Lascia stare' },
};

function ComparableRow({ item }: { item: WeightedComparable }) {
  const { comparable } = item;
  const date = formatDate(comparable.soldAt);

  return (
    <li className="border-t border-line py-3 first:border-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <a
          href={comparable.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm font-medium underline decoration-line underline-offset-4"
        >
          {comparable.title}
        </a>
        <span className="shrink-0 font-mono text-sm">{formatEur(item.priceEur)}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Pill tone={comparable.kind === 'sold' ? 'accent' : 'neutral'}>
          {comparable.kind === 'sold' ? 'Venduto' : 'Richiesto'}
        </Pill>
        <Pill>{MATCH_LABELS[comparable.matchLevel]}</Pill>
        <Pill>{comparable.source}</Pill>
        {date ? <Pill>{date}</Pill> : null}
        <Pill>peso {item.weight.toFixed(2)}</Pill>
      </div>
      {comparable.notes ? <p className="mt-1.5 text-xs text-muted">{comparable.notes}</p> : null}
    </li>
  );
}

export function ResultView({
  result,
  saveSlot,
}: {
  result: AnalysisResult;
  saveSlot?: ReactNode;
}) {
  const { identification, market, marketSource, valuation, flip, warnings } = result;
  const decision = flip?.atPrice ?? null;

  return (
    <div className="mt-6 space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold leading-tight">{identification.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {[
                identification.category,
                identification.brand,
                identification.model,
                identification.period,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <Pill
            tone={
              identification.confidence >= 0.75
                ? 'accent'
                : identification.confidence >= 0.5
                  ? 'warn'
                  : 'danger'
            }
          >
            Identificazione {Math.round(identification.confidence * 100)}%
          </Pill>
        </div>
      </Card>

      {valuation.available ? (
        <Card>
          <p className="text-sm text-muted">Valore di rivendita stimato</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">
            {formatRange(valuation.low, valuation.high)}
          </p>
          <p className="mt-2 text-sm text-muted">
            Piu’ probabile intorno a <strong className="text-foreground">{formatEur(valuation.likely)}</strong> ·{' '}
            {CONFIDENCE_LABELS[valuation.confidence]}
          </p>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {valuation.reasons.map((reason) => (
              <li key={reason}>— {reason}</li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="border-warn/40 bg-warn-soft">
          <p className="text-sm font-medium text-warn">Valore non stimabile</p>
          <p className="mt-1 text-sm">
            Riusciamo a identificare l’oggetto, ma non abbiamo dati di mercato abbastanza affidabili
            per dire quanto vale. {valuation.reason}
          </p>
        </Card>
      )}

      {flip ? (
        <Card>
          {decision ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted">
                  A {formatEur(decision.purchasePrice)} di prezzo di acquisto
                </p>
                <p
                  className={`mt-1 inline-flex rounded-xl px-3 py-1.5 text-3xl font-semibold ${
                    RECOMMENDATION_STYLES[decision.recommendation].tone
                  }`}
                >
                  {RECOMMENDATION_STYLES[decision.recommendation].label}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-3xl font-semibold">{decision.score}</p>
                <p className="text-xs text-muted">flip score / 100</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Indica il prezzo richiesto per avere una raccomandazione secca.
            </p>
          )}

          <div className="mt-4 rounded-xl border border-line p-4 text-sm">
            <p className="font-medium">Fino a quanto conviene pagarlo</p>
            {flip.thresholds.maybeUpTo === null ? (
              <p className="mt-2 text-muted">
                Nessun prezzo di acquisto rende questo oggetto un buon affare: il margine atteso non
                copre i costi di rivendita.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-muted">
                {flip.thresholds.buyUpTo !== null ? (
                  <li>
                    Affare fino a{' '}
                    <strong className="text-foreground">{formatEur(flip.thresholds.buyUpTo)}</strong>
                  </li>
                ) : (
                  <li>
                    Nessun prezzo lo rende un affare sicuro: la stima e’ troppo incerta per consigliarlo
                    senza riserve.
                  </li>
                )}
                <li>
                  Ci puoi pensare fino a{' '}
                  <strong className="text-foreground">{formatEur(flip.thresholds.maybeUpTo)}</strong>
                </li>
                <li>Sopra quella soglia, lascia stare.</li>
              </ul>
            )}
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium">Perche’</p>
            <ul className="mt-2 space-y-1 text-sm">
              {flip.factors.map((factor) => (
                <li
                  key={factor.label}
                  className={factor.direction === 'positive' ? 'text-accent' : 'text-danger'}
                >
                  {factor.direction === 'positive' ? '+' : '−'} {factor.label}
                </li>
              ))}
            </ul>
          </div>

          {decision ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-line p-4 text-sm">
              <div>
                <dt className="text-muted">Vendita attesa</dt>
                <dd className="font-mono">{formatEur(decision.economics.expectedSalePrice)}</dd>
              </div>
              <div>
                <dt className="text-muted">Commissioni</dt>
                <dd className="font-mono">−{formatEur(decision.economics.marketplaceFees, { precise: true })}</dd>
              </div>
              <div>
                <dt className="text-muted">Spedizione</dt>
                <dd className="font-mono">−{formatEur(decision.economics.shipping)}</dd>
              </div>
              <div>
                <dt className="text-muted">Margine atteso</dt>
                <dd className="font-mono">
                  {formatEur(decision.economics.expectedProfit, { precise: true })}
                  {decision.economics.roi !== null
                    ? ` · ROI ${Math.round(decision.economics.roi * 100)}%`
                    : ''}
                </dd>
              </div>
            </dl>
          ) : null}
        </Card>
      ) : null}

      {warnings.length > 0 ? (
        <Card className="border-warn/40 bg-warn-soft">
          <p className="text-sm font-medium text-warn">Da tenere presente</p>
          <ul className="mt-2 space-y-1 text-sm">
            {warnings.map((warning) => (
              <li key={warning}>— {warning}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Disclosure summary="Dettagli dell’oggetto">
        <dl className="space-y-3">
          <div>
            <dt className="text-muted">Stato</dt>
            <dd>{CONDITION_LABELS[identification.condition] ?? identification.condition}</dd>
          </div>
          {identification.conditionNotes.length > 0 ? (
            <div>
              <dt className="text-muted">Difetti rilevati</dt>
              <dd>{identification.conditionNotes.join(' · ')}</dd>
            </div>
          ) : null}
          {identification.materials.length > 0 ? (
            <div>
              <dt className="text-muted">Materiali</dt>
              <dd>{identification.materials.join(' · ')}</dd>
            </div>
          ) : null}
          {identification.characteristics.length > 0 ? (
            <div>
              <dt className="text-muted">Caratteristiche</dt>
              <dd>{identification.characteristics.join(' · ')}</dd>
            </div>
          ) : null}
          {identification.markings.length > 0 ? (
            <div>
              <dt className="text-muted">Marchi e punzoni letti</dt>
              <dd className="font-mono text-xs">{identification.markings.join(' · ')}</dd>
            </div>
          ) : null}
          {identification.missingShots.length > 0 ? (
            <div>
              <dt className="text-muted">Foto che aiuterebbero</dt>
              <dd>{identification.missingShots.join(' · ')}</dd>
            </div>
          ) : null}
        </dl>
      </Disclosure>

      {identification.history ? (
        <Disclosure summary="Cos’e’, in breve">
          <p className="leading-relaxed">{identification.history}</p>
        </Disclosure>
      ) : null}

      {valuation.available && valuation.used.length > 0 ? (
        <Disclosure summary={`Comparabili usati (${valuation.used.length})`}>
          <ul>
            {valuation.used.map((item) => (
              <ComparableRow key={`${item.comparable.url}-${item.comparable.price}`} item={item} />
            ))}
          </ul>
        </Disclosure>
      ) : null}

      {valuation.discarded.length > 0 ? (
        <Disclosure summary={`Comparabili scartati (${valuation.discarded.length})`}>
          <ul className="space-y-2">
            {valuation.discarded.map(({ comparable, reason }) => (
              <li key={`${comparable.url}-${comparable.price}`} className="text-muted">
                <span className="text-foreground">{comparable.title}</span> — {reason}
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}

      {market ? (
        <Disclosure summary="Lettura del mercato">
          {marketSource ? (
            <p className="mb-2 text-muted">
              {describeMarketSource(marketSource)}
            </p>
          ) : null}
          <p>
            Domanda {DEMAND_LABELS[market.demand]} · {LIQUIDITY_LABELS[market.liquidity]}
          </p>
          {market.notes.length > 0 ? (
            <ul className="mt-2 space-y-1 text-muted">
              {market.notes.map((note) => (
                <li key={note}>— {note}</li>
              ))}
            </ul>
          ) : null}
        </Disclosure>
      ) : null}

      {saveSlot}
    </div>
  );
}
