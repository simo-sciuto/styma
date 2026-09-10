'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

import type { AnalysisResult } from '@/schemas/analysis';
import { Card, Disclosure, Pill } from '@/components/ui';
import { DecisionBlock } from './decision/DecisionBlock';
import { Authenticity } from './identity/Authenticity';
import { ObjectEvidence } from './identity/ObjectEvidence';
import { Deals } from './market/Deals';
import { MarketScan } from './market/MarketScan';
import { RiskList } from './risks/RiskList';
import { Ledger } from './flip/Ledger';
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
        L'identita' non ha piu' una scheda attorno.

        Era un blocco con lo stesso bordo e lo stesso fondo del verdetto,
        quindi diceva «conto quanto lui» — e occupava la parte alta dello
        schermo esattamente dove serve la risposta. L'oggetto lo hai appena
        fotografato e ce l'hai in mano: la riga serve a confermare che
        abbiamo guardato il tuo, non a essere letta. Senza scatola sta in
        centoventi pixel e il verdetto entra nella prima schermata.
      */}
      <div className="flex items-center gap-3">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            width={200}
            height={200}
            unoptimized
            className="h-16 w-16 shrink-0 rounded-block border-2 border-line object-cover"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 text-[clamp(1.25rem,1.1rem+0.9vw,1.6rem)] font-semibold leading-[1.05] tracking-tight text-balance">
            {titolo}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span>{sottotitolo}</span>
            <Pill
              tone={
                identification.confidence >= 0.75
                  ? 'accent'
                  : identification.confidence >= 0.5
                    ? 'warn'
                    : 'danger'
              }
            >
              {Math.round(identification.confidence * 100)}% sicuri
            </Pill>
          </p>
        </div>
      </div>

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

      {/*
        Cosa fai adesso, subito sotto il verdetto.
        Stava in fondo alla pagina, dopo tutte le prove: ma e' l'unica
        sezione che parla di quello che puo' sapere solo chi e' li', e il
        momento in cui serve e' il secondo dopo aver letto COMPRALO — con
        l'oggetto in mano e il venditore che aspetta.
      */}
      <BeforeYouBuy identification={identification} />

      {/*
        Le stesse inserzioni che hanno fatto la stima, lette per quello che
        sono anche state tutto il tempo: cose comprabili. Sta qui, subito dopo
        il verdetto, perche' e' l'unica cosa in pagina che puo' cambiare la
        risposta — non «quanto pagarlo» ma «forse non e' questo da comprare».
      */}
      {valuation.available && flip ? (
        <Deals valuation={valuation} thresholds={flip.thresholds} />
      ) : null}

      {valuation.available && flip ? (
        <Ledger
          thresholds={flip.thresholds}
          economics={decision?.economics ?? null}
          valuation={valuation}
        />
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
        Livello 3: quello che si legge solo se ti viene un dubbio.

        Erano cinque blocchi in fila con lo stesso peso di tutto il resto —
        autenticita', prove dell'identificazione, punteggio, storia — e la
        loro utilita' non e' «prima di decidere» ma «se qualcosa non torna».
        Sotto un'intestazione sola e tutti chiusi occupano una schermata
        invece di cinque, e chi ha bisogno di controllare sa dove guardare.
      */}
      <section className="border-t-2 border-line pt-5">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Se vuoi controllare
        </p>

        <div className="mt-3 space-y-2">
          <ObjectEvidence identification={identification} />
          {/* Subito dopo le prove dell'identificazione, perche' e' la stessa
              domanda portata un passo piu' in la': non «cos'e'» ma «quanto
              regge il fatto che sia proprio quello». */}
          <Authenticity authenticity={identification.authenticity} />

          {/* Il punteggio risponde a un'altra domanda rispetto al prezzo
              massimo — non «quanto pagarlo» ma «quanto e' buona questa
              occasione» — e due numeri grandi vicini si contendono lo
              sguardo senza che nessuno dica quale guardare. */}
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

          {identification.history ? (
            <Disclosure summary="Cos’e’, in breve">
              <p className="leading-relaxed">{identification.history}</p>
            </Disclosure>
          ) : null}
        </div>
      </section>

      {saveSlot}
    </div>
  );
}
