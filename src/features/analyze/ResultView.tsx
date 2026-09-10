'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

import type { AnalysisResult } from '@/schemas/analysis';
import type { PreparedImage } from '@/lib/images';
import { Card, Disclosure, Pill } from '@/components/ui';
import { DecisionBlock } from './decision/DecisionBlock';
import { ObjectEvidence } from './identity/ObjectEvidence';
import { MarketScan } from './market/MarketScan';
import { RiskList } from './risks/RiskList';
import {
  formatEur,
} from '@/lib/format';

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
  const { identification, market, marketSource, valuation, flip } = result;
  const decision = flip?.atPrice ?? null;
  const cover = images[0] ?? null;

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

      {valuation.available ? (
        <MarketScan valuation={valuation} market={market} marketSource={marketSource} />
      ) : null}

      <RiskList result={result} />

      {identification.history ? (
        <Disclosure summary="Cos’e’, in breve">
          <p className="leading-relaxed">{identification.history}</p>
        </Disclosure>
      ) : null}

      {saveSlot}
    </div>
  );
}
