import { describe, expect, it } from 'vitest';

import { summarizeInventory } from './summary';
import { flipConfig } from '@/services/valuation/config';
import { item, valuedAt } from './testing';

describe('totali del magazzino', () => {
  it('un inventario vuoto non inventa zeri', () => {
    const summary = summarizeInventory([]);
    expect(summary.items).toBe(0);
    // Null, non 0: "hai speso 0 €" e "non hai registrato spese" non sono
    // la stessa cosa, e il secondo e' cio' che sappiamo davvero.
    expect(summary.spentEur).toBeNull();
    expect(summary.estimatedValueEur).toBeNull();
    expect(summary.potentialMarginEur).toBeNull();
    expect(summary.realizedMarginEur).toBeNull();
  });

  it('somma solo gli oggetti che hanno il dato, e dichiara quanti sono', () => {
    const summary = summarizeInventory([
      { item: item({ purchase_price: 10 }), valuation: valuedAt(100) },
      { item: item({ purchase_price: null }), valuation: valuedAt(50) },
      { item: item({ purchase_price: 5 }), valuation: null },
    ]);

    expect(summary.items).toBe(3);
    expect(summary.valued).toBe(2);
    expect(summary.estimatedValueEur).toBe(150);
    expect(summary.bought).toBe(2);
    expect(summary.spentEur).toBe(15);
  });

  it('il margine esce solo dagli oggetti che hanno prezzo pagato e stima', () => {
    // Il secondo oggetto ha una stima ma non un prezzo pagato: sommarlo
    // gonfierebbe il margine con un ricavo senza il suo costo.
    const summary = summarizeInventory([
      { item: item({ purchase_price: 10 }), valuation: valuedAt(100) },
      { item: item({ purchase_price: null }), valuation: valuedAt(900) },
    ]);

    expect(summary.withBoth).toBe(1);

    const atteso = Math.round(
      100 - 10 - 100 * flipConfig.marketplaceFeeRate,
    );
    expect(summary.potentialMarginEur).toBe(atteso);
  });

  it('un margine puo’ essere negativo, e resta negativo', () => {
    // Pagato piu' di quanto vale: nasconderlo o azzerarlo sarebbe la bugia
    // piu' comoda di un inventario.
    const summary = summarizeInventory([
      { item: item({ purchase_price: 200 }), valuation: valuedAt(50) },
    ]);
    expect(summary.potentialMarginEur).toBeLessThan(0);
  });

  it('conta gli oggetti per stato', () => {
    const summary = summarizeInventory([
      { item: item({ status: 'found' }), valuation: null },
      { item: item({ status: 'passed' }), valuation: null },
      { item: item({ status: 'sold', sale_price: 10 }), valuation: null },
      { item: item({ status: 'sold', sale_price: 10 }), valuation: null },
    ]);
    expect(summary.byStatus).toEqual({ found: 1, passed: 1, bought: 0, listed: 0, sold: 2 });
  });
});

describe('quello che e’ successo davvero', () => {
  it('un venduto esce dal margine atteso ed entra in quello realizzato', () => {
    // Sommarlo in entrambi conterebbe due volte lo stesso oggetto, una come
    // promessa e una come fatto.
    const summary = summarizeInventory([
      {
        item: item({ status: 'sold', purchase_price: 20, sale_price: 90 }),
        valuation: valuedAt(100),
      },
    ]);

    expect(summary.withBoth).toBe(0);
    expect(summary.potentialMarginEur).toBeNull();
    expect(summary.soldWithBoth).toBe(1);
    expect(summary.realizedMarginEur).toBe(
      Math.round(90 - 20 - 90 * flipConfig.marketplaceFeeRate),
    );
  });

  it('un venduto senza prezzo pagato non produce un margine finto', () => {
    const summary = summarizeInventory([
      { item: item({ status: 'sold', purchase_price: null, sale_price: 90 }), valuation: null },
    ]);
    expect(summary.sold).toBe(1);
    expect(summary.soldWithBoth).toBe(0);
    expect(summary.realizedMarginEur).toBeNull();
  });

  it('conta quante vendite sono cadute dentro la fascia che avevamo dato', () => {
    // E' il voto del prodotto, e lo da' il mercato. Senza questo conteggio
    // ogni stima resta per sempre "plausibile".
    const stima = { low_value: 50, high_value: 80, likely_value: 65 };
    const summary = summarizeInventory([
      { item: item({ status: 'sold', sale_price: 60 }), valuation: valuedAt(0) },
      { item: item({ status: 'sold', sale_price: 60 }), valuation: { ...valuedAt(65), ...stima } },
      { item: item({ status: 'sold', sale_price: 30 }), valuation: { ...valuedAt(65), ...stima } },
      // Senza stima non c'e' niente da verificare: non conta ne' come
      // centro ne' come errore.
      { item: item({ status: 'sold', sale_price: 60 }), valuation: null },
    ]);

    expect(summary.checkedAgainstEstimate).toBe(3);
    expect(summary.insideEstimate).toBe(1);
  });

  it('i bordi della fascia contano come dentro', () => {
    const summary = summarizeInventory([
      {
        item: item({ status: 'sold', sale_price: 80 }),
        valuation: { ...valuedAt(65), low_value: 50, high_value: 80 },
      },
    ]);
    expect(summary.insideEstimate).toBe(1);
  });
});
