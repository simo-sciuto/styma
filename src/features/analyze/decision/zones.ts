import type { PriceThresholds, Recommendation } from '@/schemas/analysis';

export type ZoneKey = 'buy' | 'negotiate' | 'pass';

export type ZoneSegment = {
  key: ZoneKey;
  from: number;
  to: number;
  /** Quota della barra occupata da questa fascia, 0-1. */
  ratio: number;
};

export type ZoneBar = {
  /** Il prezzo a destra della barra: oltre non si disegna. */
  scaleMax: number;
  segments: ZoneSegment[];
  /** Dove cade il prezzo richiesto, se e' stato scritto. */
  marker: { price: number; ratio: number; zone: ZoneKey } | null;
};

/**
 * Quanto in la' arrivare col disegno della barra.
 *
 * Un po' oltre la soglia della trattativa, perche' la fascia rossa deve
 * vedersi: una barra che finisce esattamente dove finisce il giallo non
 * mostra che esiste un "troppo caro". E sempre oltre il prezzo richiesto,
 * altrimenti l'indicatore uscirebbe dal grafico proprio quando la risposta
 * e' "no", cioe' quando serve di piu' vederlo.
 */
function scaleFor(thresholds: PriceThresholds, askingPrice: number | null): number {
  const top = thresholds.maybeUpTo ?? thresholds.buyUpTo ?? 0;
  const fromThresholds = top > 0 ? top * 1.4 : 0;
  const fromAsking = askingPrice !== null && askingPrice > 0 ? askingPrice * 1.15 : 0;
  return Math.max(fromThresholds, fromAsking, 1);
}

export function zoneAt(price: number, thresholds: PriceThresholds): ZoneKey {
  if (thresholds.buyUpTo !== null && price <= thresholds.buyUpTo) return 'buy';
  if (thresholds.maybeUpTo !== null && price <= thresholds.maybeUpTo) return 'negotiate';
  return 'pass';
}

/**
 * Le tre fasce come barra unica, da disegnare senza far fare conti a nessuno.
 *
 * Le soglie arrivano gia' calcolate da `priceThresholds`: qui non si decide
 * niente sul prezzo, si decide solo quanto spazio prende ogni fascia. Se una
 * soglia manca, la sua fascia sparisce invece di essere disegnata a zero:
 * una fascia verde larga un pixel direbbe "esiste un affare" quando non
 * esiste.
 */
export function zoneBar(thresholds: PriceThresholds, askingPrice: number | null): ZoneBar | null {
  const { buyUpTo, maybeUpTo } = thresholds;
  if (buyUpTo === null && maybeUpTo === null) return null;

  const scaleMax = scaleFor(thresholds, askingPrice);
  const segments: ZoneSegment[] = [];

  const push = (key: ZoneKey, from: number, to: number) => {
    const clampedTo = Math.min(to, scaleMax);
    if (clampedTo <= from) return;
    segments.push({ key, from, to: clampedTo, ratio: (clampedTo - from) / scaleMax });
  };

  const buyEnd = buyUpTo ?? 0;
  const negotiateEnd = maybeUpTo ?? buyEnd;

  push('buy', 0, buyEnd);
  push('negotiate', buyEnd, negotiateEnd);
  push('pass', negotiateEnd, scaleMax);

  const marker =
    askingPrice !== null && askingPrice >= 0
      ? {
          price: askingPrice,
          ratio: Math.min(askingPrice / scaleMax, 1),
          zone: zoneAt(askingPrice, thresholds),
        }
      : null;

  return { scaleMax, segments, marker };
}

/** Le stesse tre parole ovunque compaia il verdetto. */
export const ZONE_FOR_RECOMMENDATION: Record<Recommendation, ZoneKey> = {
  BUY: 'buy',
  MAYBE: 'negotiate',
  PASS: 'pass',
};
