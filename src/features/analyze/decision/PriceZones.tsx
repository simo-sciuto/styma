'use client';

import type { PriceThresholds } from '@/schemas/analysis';
import { formatEur } from '@/lib/format';
import { zoneBar, type ZoneKey } from './zones';

/* Le stesse tinte del verdetto: la barra dice dove cade il prezzo e il
   blocco sopra dice come si chiama quel punto. Se i due usassero due verdi
   diversi sarebbero due informazioni invece che una detta due volte. */
const FILL: Record<ZoneKey, string> = {
  buy: 'bg-verdict-buy',
  negotiate: 'bg-verdict-maybe',
  pass: 'bg-verdict-pass',
};

/**
 * Tre parole, tre cose diverse. "Troppo" per l'ultima fascia diceva una cosa
 * che non sappiamo — troppo per chi? — e la faceva leggere come un muro: sopra
 * la soglia non e' vietato comprare, e' che non ci resta margine.
 */
const LABEL: Record<ZoneKey, string> = {
  buy: 'ci guadagni bene',
  negotiate: 'margine sottile',
  pass: 'niente margine',
};

/**
 * Le tre fasce come una barra sola, con l'indicatore sul prezzo richiesto.
 *
 * L'alternativa era tre righe di testo con tre cifre da confrontare a mente.
 * Chi legge sta in piedi davanti a un banco con il venditore che aspetta:
 * deve vedere da che parte cade il prezzo, non calcolarlo.
 */
export function PriceZones({
  thresholds,
  askingPrice,
}: {
  thresholds: PriceThresholds;
  askingPrice: number | null;
}) {
  const bar = zoneBar(thresholds, askingPrice);
  if (!bar) return null;

  return (
    <div>
      <div
        className="relative"
        role="img"
        aria-label={
          thresholds.buyUpTo !== null
            ? `Ci guadagni bene fino a ${formatEur(thresholds.buyUpTo)}, margine sottile fino a ${formatEur(thresholds.maybeUpTo ?? thresholds.buyUpTo)}, oltre non resta margine`
            : `Margine sottile fino a ${formatEur(thresholds.maybeUpTo ?? 0)}, oltre non resta margine`
        }
      >
        <div className="flex h-4 overflow-hidden rounded-[0.35rem] border-2 border-line">
          {bar.segments.map((segment) => (
            <div
              key={segment.key}
              className={FILL[segment.key]}
              style={{ width: `${segment.ratio * 100}%` }}
            />
          ))}
        </div>

        {bar.marker ? (
          <div
            className="absolute -top-1.5 h-7 w-1 -translate-x-1/2 rounded-[0.15rem] border-2 border-line bg-surface"
            style={{ left: `${bar.marker.ratio * 100}%` }}
            aria-hidden
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {bar.segments.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1.5 text-muted">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-[0.15rem] border-2 border-line ${FILL[segment.key]}`} aria-hidden />
            {LABEL[segment.key]}
            {segment.key === 'pass' ? (
              <span className="font-mono">oltre {formatEur(segment.from)}</span>
            ) : (
              <span className="font-mono">fino a {formatEur(segment.to)}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
