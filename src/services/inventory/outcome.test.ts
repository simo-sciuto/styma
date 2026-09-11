import { describe, expect, it } from 'vitest';

import { daysBetween, describeOutcome } from './outcome';
import { item, valuation } from './testing';

const OGGI = Date.parse('2026-03-20T09:00:00Z');

describe('giorni fra due date', () => {
  it('conta i giorni pieni', () => {
    expect(daysBetween('2026-03-01', '2026-03-20')).toBe(19);
  });

  it('senza una delle due date non inventa un numero', () => {
    expect(daysBetween(null, '2026-03-20')).toBeNull();
    expect(daysBetween('2026-03-01', null)).toBeNull();
    expect(daysBetween('non una data', '2026-03-20')).toBeNull();
  });
});

describe('com’e’ andata', () => {
  it('un oggetto solo analizzato resta aperto', () => {
    expect(describeOutcome(item(), null, OGGI)).toEqual({ kind: 'open' });
  });

  it('lasciato perdere e’ una decisione registrata, non un vuoto', () => {
    const outcome = describeOutcome(item({ status: 'passed', asking_price: 40 }), null, OGGI);
    expect(outcome).toEqual({ kind: 'passed', askingPrice: 40 });
  });

  it('comprato: quanto hai strappato trattando', () => {
    const outcome = describeOutcome(
      item({ status: 'bought', asking_price: 40, purchase_price: 25, purchase_date: '2026-03-01' }),
      null,
      OGGI,
    );

    expect(outcome.kind).toBe('holding');
    if (outcome.kind !== 'holding') throw new Error('doveva essere in magazzino');
    expect(outcome.negotiated).toBe(15);
    expect(outcome.daysHeld).toBe(19);
    // Non e' ancora in vendita: i giorni sul mercato non esistono, e zero
    // direbbe "ci e' appena andato".
    expect(outcome.daysOnMarket).toBeNull();
  });

  it('senza prezzo chiesto non si sa se hai trattato', () => {
    const outcome = describeOutcome(
      item({ status: 'bought', asking_price: null, purchase_price: 25 }),
      null,
      OGGI,
    );
    if (outcome.kind !== 'holding') throw new Error('doveva essere in magazzino');
    expect(outcome.negotiated).toBeNull();
  });

  it('venduto: il margine lordo e’ una sottrazione fra due cifre che hai digitato tu', () => {
    const outcome = describeOutcome(
      item({
        status: 'sold',
        asking_price: 40,
        purchase_price: 25,
        purchase_date: '2026-01-10',
        listed_at: '2026-01-20',
        sale_price: 90,
        sale_date: '2026-02-09',
        marketplace: 'eBay',
      }),
      null,
      OGGI,
    );

    if (outcome.kind !== 'sold') throw new Error('doveva essere venduto');
    expect(outcome.grossMargin).toBe(65);
    expect(outcome.daysHeld).toBe(30);
    expect(outcome.daysOnMarket).toBe(20);
  });

  it('venduto senza sapere quanto l’avevi pagato: nessun margine, non uno zero', () => {
    const outcome = describeOutcome(
      item({ status: 'sold', purchase_price: null, sale_price: 90, sale_date: '2026-02-09' }),
      null,
      OGGI,
    );
    if (outcome.kind !== 'sold') throw new Error('doveva essere venduto');
    expect(outcome.grossMargin).toBeNull();
    expect(outcome.daysHeld).toBeNull();
  });

  it('dice dove e’ caduto il prezzo di vendita rispetto alla fascia', () => {
    // E' il momento in cui il prodotto puo' essere smentito, ed e' l'unica
    // ragione per cui questo file esiste.
    const stima = valuation({ low_value: 50, high_value: 80, likely_value: 65 });
    const vendutoA = (price: number) =>
      describeOutcome(item({ status: 'sold', sale_price: price }), stima, OGGI);

    for (const [price, atteso] of [
      [40, 'below'],
      [50, 'inside'],
      [65, 'inside'],
      [80, 'inside'],
      [120, 'above'],
    ] as const) {
      const outcome = vendutoA(price);
      if (outcome.kind !== 'sold') throw new Error('doveva essere venduto');
      expect(outcome.vsEstimate?.verdict).toBe(atteso);
    }
  });

  it('senza una fascia salvata non c’e’ niente da verificare', () => {
    const outcome = describeOutcome(item({ status: 'sold', sale_price: 90 }), valuation(), OGGI);
    if (outcome.kind !== 'sold') throw new Error('doveva essere venduto');
    expect(outcome.vsEstimate).toBeNull();
  });
});
