import { describe, expect, it } from 'vitest';

import type { PriceThresholds } from '@/schemas/analysis';
import { zoneAt, zoneBar } from './zones';

function thresholds(buyUpTo: number | null, maybeUpTo: number | null): PriceThresholds {
  return {
    buyUpTo,
    maybeUpTo,
    breakdown: { expectedSalePrice: 65, fees: 6.5, riskBuffer: 4.5, targetProfit: 16.25 },
  };
}

describe('fascia di un prezzo', () => {
  const t = thresholds(28, 44);

  it('rispetta i bordi', () => {
    expect(zoneAt(0, t)).toBe('buy');
    expect(zoneAt(28, t)).toBe('buy');
    expect(zoneAt(29, t)).toBe('negotiate');
    expect(zoneAt(44, t)).toBe('negotiate');
    expect(zoneAt(45, t)).toBe('pass');
  });

  it('senza soglia dell’affare la fascia verde non esiste', () => {
    const senzaAffare = thresholds(null, 44);
    expect(zoneAt(0, senzaAffare)).toBe('negotiate');
    expect(zoneAt(45, senzaAffare)).toBe('pass');
  });

  it('senza nessuna soglia qualunque prezzo e’ troppo', () => {
    expect(zoneAt(0, thresholds(null, null))).toBe('pass');
  });
});

describe('barra delle fasce', () => {
  it('copre l’intera larghezza, senza buchi ne’ sovrapposizioni', () => {
    const bar = zoneBar(thresholds(28, 44), null);
    expect(bar).not.toBeNull();

    const somma = bar!.segments.reduce((total, segment) => total + segment.ratio, 0);
    expect(somma).toBeCloseTo(1, 10);

    // Ogni fascia comincia dove finisce la precedente.
    for (let i = 1; i < bar!.segments.length; i += 1) {
      expect(bar!.segments[i]!.from).toBe(bar!.segments[i - 1]!.to);
    }
  });

  it('le tre fasce sono in ordine', () => {
    const bar = zoneBar(thresholds(28, 44), null);
    expect(bar!.segments.map((segment) => segment.key)).toEqual(['buy', 'negotiate', 'pass']);
  });

  it('una fascia che non esiste non viene disegnata a zero', () => {
    // Una striscia verde larga un pixel direbbe "un affare esiste" quando
    // nessun prezzo lo rende tale.
    const bar = zoneBar(thresholds(null, 44), null);
    expect(bar!.segments.map((segment) => segment.key)).toEqual(['negotiate', 'pass']);
  });

  it('senza soglie non c’e’ barra da disegnare', () => {
    expect(zoneBar(thresholds(null, null), null)).toBeNull();
  });

  it('l’indicatore resta dentro il grafico anche a un prezzo assurdo', () => {
    // E' proprio quando la risposta e' "no" che l'indicatore deve vedersi.
    const bar = zoneBar(thresholds(28, 44), 500);
    expect(bar!.marker!.ratio).toBeLessThanOrEqual(1);
    expect(bar!.marker!.zone).toBe('pass');
    expect(bar!.scaleMax).toBeGreaterThanOrEqual(500);
  });

  it('l’indicatore cade nella fascia giusta', () => {
    const t = thresholds(28, 44);
    expect(zoneBar(t, 18)!.marker!.zone).toBe('buy');
    expect(zoneBar(t, 35)!.marker!.zone).toBe('negotiate');
    expect(zoneBar(t, 60)!.marker!.zone).toBe('pass');
  });

  it('senza prezzo richiesto la barra si disegna lo stesso, senza indicatore', () => {
    const bar = zoneBar(thresholds(28, 44), null);
    expect(bar!.marker).toBeNull();
    expect(bar!.segments.length).toBe(3);
  });

  it('la fascia rossa si vede sempre: la barra non finisce dove finisce il giallo', () => {
    const bar = zoneBar(thresholds(28, 44), null);
    const pass = bar!.segments.find((segment) => segment.key === 'pass');
    expect(pass!.ratio).toBeGreaterThan(0);
  });
});
