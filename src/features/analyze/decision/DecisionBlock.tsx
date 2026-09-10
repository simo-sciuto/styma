'use client';

import type { FlipAssessment, Valuation } from '@/schemas/analysis';
import { RECOMMENDATION_STYLES, formatEur, formatRange } from '@/lib/format';
import { Disclosure } from '@/components/ui';
import { PriceZones } from './PriceZones';

/**
 * Il verdetto e' l'unico blocco a colore pieno della pagina, e solo quando e'
 * un si': l'occasione entusiasmante e' quella. "Tratta" e "lascia stare" si
 * leggono benissimo su un fondo tenue, e gridarli darebbe a ogni oggetto la
 * stessa temperatura.
 */
const VERDICT_TONE: Record<string, string> = {
  BUY: 'bg-accent-vivid text-accent-on-vivid',
  MAYBE: 'bg-warn-soft text-warn',
  PASS: 'bg-danger-soft text-danger',
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * La domanda del prodotto, in un blocco solo.
 *
 * Prima era in fondo alla pagina, dopo identita', stima e concorrenza: per
 * sapere se comprare bisognava scorrere tre schermate. Qui sopra c'e' solo
 * l'oggetto, e sotto tutto il resto — che serve a capire *perche'*, non *se*.
 *
 * Il pezzo piu' importante e' la frase che collega i due numeri. «Si rivende a
 * 30–70 €» e «paga fino a 15 €» letti uno accanto all'altro sembrano darsi
 * torto, e chi legge si ferma li': la domanda «perche' non posso pagarlo 40?»
 * ha una risposta precisa — quei 70 non li incassi — e finche' stava chiusa in
 * un accordion non la leggeva nessuno.
 */
export function DecisionBlock({
  flip,
  valuation,
  purchasePrice,
  onPurchasePriceChange,
}: {
  flip: FlipAssessment;
  valuation: Extract<Valuation, { available: true }>;
  purchasePrice: string;
  onPurchasePriceChange?: (value: string) => void;
}) {
  const decision = flip.atPrice;
  const { thresholds } = flip;
  const { breakdown } = thresholds;
  const asking = decision?.purchasePrice ?? null;
  const restaInMano = thresholds.maybeUpTo;

  return (
    <section className="rounded-block border border-line bg-surface p-5 sm:p-6">
      <label className="block">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Quanto te lo chiedono
        </span>
        <span className="mt-1.5 flex items-center gap-2 rounded-2xl border border-line bg-background px-4 py-2.5 focus-within:border-accent">
          <span className="text-xl text-muted">€</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            value={purchasePrice}
            onChange={(event) => onPurchasePriceChange?.(event.target.value)}
            placeholder="18"
            aria-label="Prezzo richiesto dal venditore"
            className="w-full appearance-none bg-transparent text-2xl font-semibold tracking-tight outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </span>
      </label>

      {decision ? (
        <div
          className={`mt-4 rounded-block px-5 py-4 ${VERDICT_TONE[decision.recommendation]}`}
        >
          <p className="text-[clamp(1.75rem,1.5rem+1.4vw,2.5rem)] font-semibold leading-none tracking-tight">
            {RECOMMENDATION_STYLES[decision.recommendation].label}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-block bg-surface-warm px-5 py-4 text-sm text-muted">
          Scrivi quanto te lo chiedono e qui sopra compare la risposta.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        {/* "Vale" era la parola sbagliata: sembrava quanto vale in mano tua,
            mentre e' quanto lo paga chi lo comprera' da te. */}
        <Stat
          label="Lo rivendi a"
          value={formatRange(valuation.low, valuation.high)}
          hint={`di solito ${formatEur(valuation.likely)}`}
        />
        <Stat
          label="Paga fino a"
          value={thresholds.buyUpTo !== null ? formatEur(thresholds.buyUpTo) : '—'}
          hint={thresholds.buyUpTo === null ? 'a nessun prezzo ci guadagni' : 'per farci un affare'}
        />
      </div>

      <div className="mt-4">
        <PriceZones thresholds={thresholds} askingPrice={asking} />
      </div>

      {/*
        La riga che tiene insieme i due numeri. Senza, la pagina mostra una
        fascia larga e un prezzo massimo basso e lascia a chi legge il compito
        di indovinare il perche'.
      */}
      {restaInMano !== null ? (
        <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed">
          Sembrano due numeri lontani, e c’e’ un motivo: di{' '}
          {formatEur(breakdown.expectedSalePrice)} che incassi vendendolo, in mano te ne restano{' '}
          <strong>{formatEur(restaInMano)}</strong> — il resto se ne va in commissioni, spedizione e
          in quello che teniamo da parte perche’ la stima puo’ sbagliare. Dentro quei{' '}
          {formatEur(restaInMano)} ci stanno sia quanto paghi sia quanto ci guadagni.
        </p>
      ) : null}

      <div className="mt-3">
        <Disclosure summary="Il conto, riga per riga">
          <dl className="space-y-1.5 font-mono text-sm">
            <div className="flex justify-between gap-3">
              <dt>Lo rivendi a</dt>
              <dd>{formatEur(breakdown.expectedSalePrice, { precise: true })}</dd>
            </div>
            <div className="flex justify-between gap-3 text-muted">
              <dt>− Commissioni</dt>
              <dd>{formatEur(breakdown.fees, { precise: true })}</dd>
            </div>
            <div className="flex justify-between gap-3 text-muted">
              <dt>− Spedizione e imballo</dt>
              <dd>{formatEur(breakdown.shipping, { precise: true })}</dd>
            </div>
            <div className="flex justify-between gap-3 text-muted">
              <dt>− Tenuto da parte per sicurezza</dt>
              <dd>{formatEur(breakdown.riskBuffer, { precise: true })}</dd>
            </div>
            <div className="flex justify-between gap-3 text-muted">
              <dt>− Quanto ci guadagni</dt>
              <dd>{formatEur(breakdown.targetProfit, { precise: true })}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-1.5 font-semibold">
              <dt>Paga fino a</dt>
              <dd>{thresholds.buyUpTo !== null ? formatEur(thresholds.buyUpTo) : '—'}</dd>
            </div>
          </dl>
          <p className="mt-3 font-sans text-xs text-muted">
            Il guadagno e’ meta’ di quello che spendi, sempre: che l’oggetto costi dieci euro o
            cinquecento, la richiesta e’ la stessa. Quello che teniamo da parte, invece, cambia con
            quanto siamo sicuri — una stima fragile ti abbassa il prezzo massimo, cosi’ l’incertezza
            la paghi in trattativa e non dopo.
          </p>
        </Disclosure>
      </div>
    </section>
  );
}
