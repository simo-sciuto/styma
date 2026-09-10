'use client';

import type { FlipAssessment, Valuation } from '@/schemas/analysis';
import { CONFIDENCE_LABELS, RECOMMENDATION_STYLES, formatEur, formatRange } from '@/lib/format';
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
            className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none"
          />
        </span>
      </label>

      {decision ? (
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-block px-5 py-4 ${
            VERDICT_TONE[decision.recommendation]
          }`}
        >
          <p className="text-[clamp(1.75rem,1.5rem+1.4vw,2.5rem)] font-semibold leading-none tracking-tight">
            {RECOMMENDATION_STYLES[decision.recommendation].label}
          </p>
          <p className="text-right font-mono text-sm">
            <span className="text-2xl font-semibold">{decision.score}</span>
            <span className="opacity-70">/100</span>
            <br />
            <span className="text-[0.65rem] uppercase tracking-[0.14em]">deal score</span>
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-block bg-surface-warm px-5 py-4 text-sm text-muted">
          Scrivi il prezzo del banco e il verdetto compare qui. La stima resta valida comunque.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        <Stat
          label="Vale"
          value={formatRange(valuation.low, valuation.high)}
          hint={CONFIDENCE_LABELS[valuation.confidence].toLowerCase()}
        />
        <Stat
          label="Paga fino a"
          value={thresholds.buyUpTo !== null ? formatEur(thresholds.buyUpTo) : '—'}
          hint={thresholds.buyUpTo === null ? 'nessun prezzo lo rende un affare' : undefined}
        />
      </div>

      <div className="mt-4">
        <PriceZones thresholds={thresholds} askingPrice={asking} />
      </div>

      {/*
        Il prezzo massimo si puo' controllare riga per riga. Un numero che
        nessuno puo' verificare e' un numero da prendere per fede, e qui il
        numero e' il prodotto — ma sta chiuso, perche' la prima domanda e'
        "lo compro", non "come l'hai calcolato".
      */}
      <div className="mt-4">
        <Disclosure summary="Come nasce il prezzo massimo">
          <dl className="space-y-1.5 font-mono text-sm">
            <div className="flex justify-between gap-3">
              <dt>Vendita attesa</dt>
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
              <dt>− Cuscinetto di rischio</dt>
              <dd>{formatEur(breakdown.riskBuffer, { precise: true })}</dd>
            </div>
            <div className="flex justify-between gap-3 text-muted">
              <dt>− Margine obiettivo</dt>
              <dd>{formatEur(breakdown.targetProfit, { precise: true })}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-1.5 font-semibold">
              <dt>Paga fino a</dt>
              <dd>{thresholds.buyUpTo !== null ? formatEur(thresholds.buyUpTo) : '—'}</dd>
            </div>
          </dl>
          <p className="mt-3 font-sans text-xs text-muted">
            Il cuscinetto e’ l’unica riga che dipende da quanto siamo sicuri: piu’ la stima e’
            fragile, piu’ si tiene indietro. L’incertezza si paga in prezzo, non scaricandola su
            di te.
          </p>
        </Disclosure>
      </div>
    </section>
  );
}
