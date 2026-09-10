'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

import type { AnalysisResult } from '@/schemas/analysis';
import { Card, Disclosure, Pill } from '@/components/ui';
import { DecisionBlock } from './decision/DecisionBlock';
import { Authenticity } from './identity/Authenticity';
import { ObjectEvidence } from './identity/ObjectEvidence';
import { MarketScan } from './market/MarketScan';
import { RiskList } from './risks/RiskList';
import { FlipEconomics } from './flip/FlipEconomics';
import { BeforeYouBuy } from './checks/BeforeYouBuy';
import {
  formatEur,
} from '@/lib/format';

export function ResultView({
  result,
  coverUrl = null,
  purchasePrice = '',
  onPurchasePriceChange,
  saveSlot,
}: {
  result: AnalysisResult;
  /** La prima foto: un'anteprima locale durante l'analisi, un URL firmato
   *  quando la stessa pagina viene riaperta da salvata. */
  coverUrl?: string | null;
  /** Testo grezzo del campo prezzo: lo stato vive nel chiamante, che deve
   *  passare lo stesso numero anche al salvataggio in inventario. */
  purchasePrice?: string;
  onPurchasePriceChange?: (value: string) => void;
  saveSlot?: ReactNode;
}) {
  const { identification, market, marketSource, valuation, flip } = result;
  const decision = flip?.atPrice ?? null;

  /*
   * Il titolo e' marca e modello, non il nome lungo.
   *
   * `name` e' scritto per un annuncio — "Macchina da scrivere portatile
   * Olivetti Valentine rossa - design Ettore Sottsass" — e in cima a uno
   * schermo da telefono sono quattro righe che spingono il verdetto sotto la
   * piega, con le due parole che contano in mezzo. Chi guarda ha l'oggetto in
   * mano: non gli serve la descrizione, gli serve il nome.
   */
  const marcaModello = [identification.brand, identification.model].filter(Boolean).join(' ');
  const titolo = marcaModello || identification.name;
  const sottotitolo = [
    marcaModello ? identification.objectType : identification.category,
    identification.period,
  ]
    .filter(Boolean)
    .join(' · ');

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
          {coverUrl ? (
            <Image
              src={coverUrl}
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
            <h1 className="mt-1 line-clamp-2 text-[clamp(1.35rem,1.2rem+1vw,1.85rem)] font-semibold leading-[1.05] tracking-tight text-balance">
              {titolo}
            </h1>
            <p className="mt-1 text-sm text-muted">{sottotitolo}</p>
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

      {!valuation.available ? (
        <Card className="border-warn/40 bg-warn-soft">
          <p className="text-sm font-medium text-warn">Non sappiamo dirti quanto vale</p>
          <p className="mt-1 text-sm">
            L’oggetto lo riconosciamo, il suo mercato no: non abbiamo trovato abbastanza annunci
            comparabili per tirarci fuori un prezzo di cui fidarsi. {valuation.reason}
          </p>
          {/*
            Anche senza stima si mostra cio' che si e' visto: un rifiuto secco
            lascia chi e' davanti al banco esattamente dove stava, mentre due
            prezzi osservati — dichiarati come insufficienti — no.
          */}
          {valuation.observed ? (
            <p className="mt-3 text-sm">
              Quello che abbiamo comunque visto:{' '}
              <strong>
                {valuation.observed.count === 1
                  ? '1 annuncio'
                  : `${valuation.observed.count} annunci`}
              </strong>{' '}
              fra {formatEur(valuation.observed.lowEur)} e {formatEur(valuation.observed.highEur)}.
              Sono prezzi richiesti, troppo pochi o troppo diversi fra loro perche’ una media
              significhi qualcosa. Guardali tu prima di decidere: e’ piu’ di quanto avresti senza.
            </p>
          ) : null}
        </Card>
      ) : null}

      {decision && valuation.available ? (
        <FlipEconomics economics={decision.economics} valuation={valuation} />
      ) : null}

      {valuation.available ? (
        <MarketScan
          valuation={valuation}
          market={market}
          marketSource={marketSource}
          identification={identification}
        />
      ) : null}

      <RiskList result={result} />

      {/*
        Il punteggio e "cosa lo muove" stavano in una scheda propria, subito
        sotto il verdetto: due numeri grandi uno accanto all'altro che
        rispondono a domande diverse — "quanto pagarlo" e "quanto e' buona
        l'occasione" — e chi legge deve capire da solo quale guardare. Ora e'
        una riga sola, piegata: la domanda del prodotto resta una.
      */}
      {flip && flip.atPrice ? (
        <Disclosure summary={`Quanto e’ buona l’occasione: ${flip.atPrice.score}/100`}>
          <ul className="space-y-1">
            {flip.factors.map((factor) => (
              <li
                key={factor.label}
                className={factor.direction === 'positive' ? 'text-accent' : 'text-danger'}
              >
                {factor.direction === 'positive' ? '+' : '−'} {factor.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Non e’ quanto vale l’oggetto ne’ quanto pagarlo: e’ quanto conviene questo affare
            rispetto a un altro, a parita’ di soldi che hai in tasca.
          </p>
        </Disclosure>
      ) : null}

      <ObjectEvidence identification={identification} />

      {/* Subito dopo le prove dell'identificazione, perche' e' la stessa
          domanda portata un passo piu' in la': non «cos'e'» ma «quanto
          regge il fatto che sia proprio quello». */}
      <Authenticity authenticity={identification.authenticity} />


      <BeforeYouBuy identification={identification} />

      {identification.history ? (
        <Disclosure summary="Cos’e’, in breve">
          <p className="leading-relaxed">{identification.history}</p>
        </Disclosure>
      ) : null}

      {saveSlot}
    </div>
  );
}
