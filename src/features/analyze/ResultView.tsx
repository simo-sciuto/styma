'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

import type { AnalysisResult, MarketSource, WeightedComparable } from '@/schemas/analysis';
import type { PreparedImage } from '@/lib/images';
import { Card, Disclosure, Pill } from '@/components/ui';
import { DecisionBlock } from './decision/DecisionBlock';
import { ObjectEvidence } from './identity/ObjectEvidence';
import {
  DEMAND_LABELS,
  LIQUIDITY_LABELS,
  MATCH_LABELS,
  formatDate,
  formatEur,
} from '@/lib/format';

/**
 * L'eta' della ricerca si dichiara sempre, anche quando e' di oggi. Chi decide
 * davanti a un banco deve sapere se sta guardando il mercato di adesso o quello
 * di tre settimane fa: nasconderlo sarebbe far sembrare fresco un dato riusato.
 */
function describeMarketSource(source: MarketSource): string {
  if (!source.cached) return 'Ricerca fatta adesso, su annunci reali.';
  if (source.ageDays === 0) return 'Ricerca riusata, fatta oggi per lo stesso modello.';
  if (source.ageDays === 1) return 'Ricerca riusata, fatta ieri per lo stesso modello.';
  return `Ricerca riusata, fatta ${source.ageDays} giorni fa per lo stesso modello.`;
}

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
  images = [],
  purchasePrice = '',
  onPurchasePriceChange,
  saveSlot,
}: {
  result: AnalysisResult;
  images?: PreparedImage[];
  /** Testo grezzo del campo prezzo: lo stato vive nel chiamante, che deve
   *  passare lo stesso numero anche al salvataggio in inventario. */
  purchasePrice?: string;
  onPurchasePriceChange?: (value: string) => void;
  saveSlot?: ReactNode;
}) {
  const { identification, market, marketSource, valuation, flip, warnings } = result;
  const decision = flip?.atPrice ?? null;
  const cover = images[0] ?? null;

  /**
   * Quante alternative ha chi compra, e a che prezzi. Non e' la domanda e
   * non e' il tempo di vendita: quelli richiederebbero le vendite concluse,
   * che nessuna fonte gratuita ci da' (vedi AGENTS.md). Questa e' l'unica
   * misura di mercato che possiamo fare davvero — le inserzioni dello stesso
   * modello aperte adesso — e va chiamata col suo nome.
   *
   * Sotto le due inserzioni non e' concorrenza, e' un caso isolato.
   */
  const identicalUsed = valuation.available
    ? valuation.used.filter((item) => item.comparable.matchLevel === 'exact_model')
    : [];
  const competition =
    identicalUsed.length >= 2
      ? {
          count: identicalUsed.length,
          low: Math.min(...identicalUsed.map((item) => item.priceEur)),
          high: Math.max(...identicalUsed.map((item) => item.priceEur)),
        }
      : null;

  return (
    <div className="mt-6 space-y-4">
      {/*
        Identita' e foto su una riga sola. La foto era a tutta larghezza in
        4:3 — 257px del primo viewport su un telefono — e spingeva il
        verdetto sotto la piega. L'oggetto lo hai appena fotografato: una
        miniatura basta a confermare che abbiamo guardato il tuo.
      */}
      <Card>
        <div className="flex gap-4">
          {cover ? (
            <Image
              src={cover.previewUrl}
              alt=""
              width={200}
              height={200}
              unoptimized
              className="h-20 w-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-24"
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-tile-terracotta" aria-hidden />
              Identificato
            </p>
            <h1 className="mt-1 text-[clamp(1.35rem,1.2rem+1vw,1.85rem)] font-semibold leading-[1.05] tracking-tight text-balance">
              {identification.name}
            </h1>
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
            <div className="mt-2">
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
          </div>
        </div>
      </Card>

      {/* La domanda del prodotto, subito. Tutto cio' che segue serve a
          capire perche', non se. */}
      {valuation.available && flip ? (
        <DecisionBlock
          flip={flip}
          valuation={valuation}
          purchasePrice={purchasePrice}
          onPurchasePriceChange={onPurchasePriceChange}
        />
      ) : null}

      <ObjectEvidence identification={identification} />

      {!valuation.available ? (
        <Card className="border-warn/40 bg-warn-soft">
          <p className="text-sm font-medium text-warn">Valore non stimabile</p>
          <p className="mt-1 text-sm">
            Riusciamo a identificare l’oggetto, ma non abbiamo dati di mercato abbastanza affidabili
            per dire quanto vale. {valuation.reason}
          </p>
          {/*
            Anche senza stima si mostra cio' che si e' visto: un rifiuto secco
            lascia chi e' davanti al banco esattamente dove stava, mentre due
            prezzi osservati — dichiarati come insufficienti — no.
          */}
          {valuation.observed ? (
            <p className="mt-3 text-sm">
              Quello che abbiamo visto:{' '}
              <strong>
                {valuation.observed.count === 1
                  ? '1 annuncio'
                  : `${valuation.observed.count} annunci`}
              </strong>{' '}
              fra {formatEur(valuation.observed.lowEur)} e {formatEur(valuation.observed.highEur)}.
              Sono prezzi richiesti, troppo pochi o troppo diversi fra loro per ricavarne una stima:
              guardali tu prima di decidere.
            </p>
          ) : null}
        </Card>
      ) : null}

      {competition ? (
        <Card>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Concorrenza</p>
          <p className="mt-2 text-sm">
            <strong>{competition.count} inserzioni</strong> dello stesso modello sono in vendita
            adesso, da {formatEur(competition.low)} a {formatEur(competition.high)}.
          </p>
          <p className="mt-2 text-xs text-muted">
            E’ quante alternative ha chi compra, non quanto ci mette a vendersi: per dire i tempi
            servirebbero le vendite concluse, e non esiste una fonte gratuita che ce le dia.
          </p>
        </Card>
      ) : null}

      {flip ? (
        <Card>
          {/* Come e' nata la stima, prima di cosa muove il punteggio: sono
              due domande diverse e finivano sempre in due posti lontani. */}
          {valuation.available && valuation.reasons.length > 0 ? (
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                Come e’ nata la stima
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {valuation.reasons.map((reason) => (
                  <li key={reason}>— {reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
              Cosa muove il punteggio
            </p>
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
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-line p-4 text-sm">
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
