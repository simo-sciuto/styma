'use client';

import type { FlipAssessment, Valuation } from '@/schemas/analysis';
import { RECOMMENDATION_STYLES, formatEur, formatRange } from '@/lib/format';
import { PriceZones } from './PriceZones';

/**
 * Tutti e tre i verdetti a colore pieno, adesso, e non e' un ripensamento
 * estetico.
 *
 * Prima solo il si' prendeva il colore: "tratta" e "lascia stare" stavano su
 * un fondo tenue, perche' la palette di allora non aveva un giallo e un rosso
 * che reggessero del testo sopra — gridarli avrebbe voluto dire dare a ogni
 * oggetto la stessa temperatura. Con tre colori scelti per portare
 * l'inchiostro nero il ruolo cambia: il colore non dice piu' «quanto essere
 * entusiasti», dice *quale* dei tre e' — e a un metro di distanza, in mano,
 * al sole, e' l'unica cosa che si legge di questa pagina.
 *
 * Chi guarda ha il venditore davanti che aspetta. Deve poter distinguere il
 * verde dal rosso senza mettere a fuoco.
 */
const VERDICT_TONE: Record<string, string> = {
  BUY: 'bg-verdict-buy text-tile-ink',
  MAYBE: 'bg-verdict-maybe text-tile-ink',
  PASS: 'bg-verdict-pass text-tile-ink',
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
    /* Livello 1: l'unico blocco della pagina con bordo spesso e ombra piena.
       E' la risposta, e deve staccarsi da tutto il resto anche visto di
       sfuggita, prima ancora di essere letto. */
    <section className="rounded-block border-[3px] border-line bg-surface p-5 shadow-pop sm:p-6">
      <label className="block">
        {/* "Quanto te lo chiedono" era gergo da mercatino: chiarissimo per
            chi ci sta dentro, opaco per tutti gli altri. "Quanto costa" e' la
            domanda che fai al venditore a voce, con le stesse parole. */}
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Quanto costa
        </span>
        <span className="mt-1.5 flex items-center gap-2 rounded-block border-2 border-line bg-background px-4 py-2.5 focus-within:border-accent">
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
          className={`mt-4 rounded-block border-2 border-line px-5 py-5 ${VERDICT_TONE[decision.recommendation]}`}
        >
          <p className="text-[clamp(2rem,1.6rem+2vw,3rem)] font-semibold leading-none tracking-tighter">
            {RECOMMENDATION_STYLES[decision.recommendation].label}
          </p>
        </div>
      ) : (
        /* Lo spazio del verdetto e' occupato anche da spento: se comparisse
           dal nulla, la prima cifra digitata spingerebbe giu' tutto quello
           che sta sotto mentre il pollice e' ancora sulla tastiera. */
        <p className="mt-4 rounded-block border-[3px] border-dashed border-line px-5 py-5 text-sm text-muted">
          Scrivi quanto costa e qui ti diciamo se conviene.
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
        La riga che tiene insieme i due numeri resta, e resta aperta: senza,
        la pagina mostra una fascia larga e un prezzo massimo basso e lascia a
        chi legge il compito di indovinare il perche'. Il conto vero e' subito
        sotto, in un blocco suo — qui c'era anche una seconda copia, chiusa in
        un accordion, che diceva le stesse cose in colonna.
      */}
      {restaInMano !== null ? (
        <p className="mt-4 border-t-2 border-line pt-4 text-sm leading-relaxed">
          Sembrano due numeri lontani, e c’e’ un motivo: di{' '}
          {formatEur(breakdown.expectedSalePrice)} che incassi vendendolo, in mano te ne restano{' '}
          <strong>{formatEur(restaInMano)}</strong> — il resto se ne va in commissioni, spedizione e
          in quello che teniamo da parte perche’ la stima puo’ sbagliare. Dentro quei{' '}
          {formatEur(restaInMano)} ci stanno sia quanto paghi sia quanto ci guadagni.
        </p>
      ) : null}
    </section>
  );
}
