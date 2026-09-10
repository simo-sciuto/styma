'use client';

import type { PriceThresholds } from '@/schemas/analysis';
import { formatEur } from '@/lib/format';
import { zoneBar, type ZoneKey } from './zones';

const FILL: Record<ZoneKey, string> = {
  buy: 'bg-accent-vivid',
  negotiate: 'bg-warn',
  pass: 'bg-danger',
};

const LABEL: Record<ZoneKey, string> = {
  buy: 'affare',
  negotiate: 'trattabile',
  pass: 'troppo',
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
            ? `Affare fino a ${formatEur(thresholds.buyUpTo)}, trattabile fino a ${formatEur(thresholds.maybeUpTo ?? thresholds.buyUpTo)}, oltre e' troppo caro`
            : `Trattabile fino a ${formatEur(thresholds.maybeUpTo ?? 0)}, oltre e' troppo caro`
        }
      >
        <div className="flex h-2.5 overflow-hidden rounded-full">
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
            className="absolute -top-1 h-4.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
            style={{ left: `${bar.marker.ratio * 100}%` }}
            aria-hidden
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {bar.segments.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1.5 text-muted">
            <span className={`h-2 w-2 shrink-0 rounded-full ${FILL[segment.key]}`} aria-hidden />
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
