import { describe, expect, it } from 'vitest';

import { MIN_SALES, atYourRate, calibrate } from './calibration';
import { item, valuedAt } from './testing';

/** Una vendita conclusa: stimato `likely`, incassato `sold`. */
function vendita(likely: number, sold: number, id = `${likely}-${sold}`) {
  return {
    item: item({ id, status: 'sold', purchase_price: 10, sale_price: sold }),
    valuation: valuedAt(likely),
  };
}

describe('la tua calibrazione', () => {
  it('non dice niente finche’ non ha abbastanza vendite, e dice quante ne mancano', () => {
    // Due vendite non sono una correzione: sono due aneddoti, e un numero
    // costruito su due vendite convincerebbe piu' di quanto vale.
    const risultato = calibrate([vendita(100, 70), vendita(100, 80)]);
    expect(risultato.enough).toBe(false);
    if (risultato.enough) throw new Error('non doveva bastare');
    expect(risultato.sales).toBe(2);
    expect(risultato.needed).toBe(MIN_SALES - 2);
  });

  it('misura a quale quota della stima chiudono davvero le tue vendite', () => {
    const risultato = calibrate([
      vendita(100, 60),
      vendita(100, 70),
      vendita(100, 75),
      vendita(100, 80),
      vendita(100, 90),
    ]);
    if (!risultato.enough) throw new Error('doveva bastare');
    expect(risultato.ratio).toBe(0.75);
    expect(risultato.lowest).toBe(0.6);
    expect(risultato.highest).toBe(0.9);
    expect(risultato.sales).toBe(5);
  });

  it('una vendita fortunata non sposta la correzione', () => {
    // E' il motivo della mediana: un colpo di fortuna a tre volte la stima
    // sposterebbe una media, e non e' una correzione da applicare alla
    // prossima stima.
    const senza = calibrate([
      vendita(100, 70, 'a'),
      vendita(100, 72, 'b'),
      vendita(100, 74, 'c'),
      vendita(100, 76, 'd'),
      vendita(100, 78, 'e'),
    ]);
    const con = calibrate([
      vendita(100, 70, 'a'),
      vendita(100, 72, 'b'),
      vendita(100, 74, 'c'),
      vendita(100, 76, 'd'),
      vendita(100, 300, 'f'),
    ]);
    if (!senza.enough || !con.enough) throw new Error('dovevano bastare');
    expect(con.ratio).toBe(senza.ratio);
  });

  it('conta solo cio’ che ha entrambe le cifre', () => {
    const risultato = calibrate([
      vendita(100, 70),
      vendita(100, 75),
      vendita(100, 80),
      vendita(100, 85),
      // Venduto senza stima: non c'e' niente da confrontare.
      { item: item({ id: 'x', status: 'sold', sale_price: 90 }), valuation: null },
      // Stimato ma non venduto: il confronto non e' ancora successo.
      { item: item({ id: 'y', status: 'bought', purchase_price: 20 }), valuation: valuedAt(100) },
    ]);
    expect(risultato.enough).toBe(false);
    if (risultato.enough) throw new Error('non doveva bastare');
    expect(risultato.sales).toBe(4);
  });

  it('riporta una stima al tuo metro, e tace se non sa ancora qual e’', () => {
    const tarato = calibrate([
      vendita(100, 70),
      vendita(100, 70),
      vendita(100, 70),
      vendita(100, 70),
      vendita(100, 70),
    ]);
    expect(atYourRate(300, tarato)).toBe(210);
    expect(atYourRate(300, { enough: false, sales: 1, needed: 4 })).toBeNull();
  });
});
