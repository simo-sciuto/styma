import { describe, expect, it } from 'vitest';

import { buildLedger } from './ledger';
import { item } from './testing';

const ADESSO = new Date('2026-09-11T12:00:00Z');

describe('conto economico del magazzino', () => {
  it('un magazzino vuoto non inventa un grafico', () => {
    const ledger = buildLedger([], ADESSO);
    expect(ledger.months).toEqual([]);
    expect(ledger.totals.spentEur).toBe(0);
    expect(ledger.medianDaysToSell).toBeNull();
    expect(ledger.oldestInStockDays).toBeNull();
  });

  it('mette la spesa nel mese in cui hai pagato e l’incasso in quello in cui hai venduto', () => {
    // E' la regola che decide se il grafico dice la verita': un oggetto
    // comprato a marzo e venduto a luglio ha svuotato il portafoglio a marzo.
    const ledger = buildLedger(
      [
        item({
          status: 'sold',
          purchase_price: 30,
          purchase_date: '2026-03-14',
          sale_price: 100,
          sale_date: '2026-07-02',
        }),
      ],
      ADESSO,
    );

    const marzo = ledger.months.find((m) => m.month === '2026-03')!;
    const luglio = ledger.months.find((m) => m.month === '2026-07')!;

    expect(marzo.spentEur).toBe(30);
    expect(marzo.earnedEur).toBe(0);
    expect(luglio.spentEur).toBe(0);
    expect(luglio.earnedEur).toBe(100);
  });

  it('il margine sta nel mese della vendita', () => {
    const ledger = buildLedger(
      [
        item({
          status: 'sold',
          purchase_price: 30,
          purchase_date: '2026-03-14',
          sale_price: 100,
          sale_date: '2026-07-02',
        }),
      ],
      ADESSO,
    );

    const luglio = ledger.months.find((m) => m.month === '2026-07')!;
    expect(luglio.marginEur).toBe(100 - 30);
    // Marzo e' un mese di soli acquisti: margine zero, non margine negativo.
    // Non hai perso niente, hai comprato.
    expect(ledger.months.find((m) => m.month === '2026-03')!.marginEur).toBe(0);
  });

  it('non salta i mesi vuoti in mezzo: un mese fermo e’ un’informazione', () => {
    const ledger = buildLedger(
      [
        item({ status: 'bought', purchase_price: 10, purchase_date: '2026-01-05' }),
        item({ status: 'bought', purchase_price: 20, purchase_date: '2026-04-05' }),
      ],
      ADESSO,
    );

    expect(ledger.months.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(ledger.months[1]!.spentEur).toBe(0);
  });

  it('attraversa il capodanno senza perdersi', () => {
    const ledger = buildLedger(
      [
        item({ status: 'bought', purchase_price: 10, purchase_date: '2025-11-30' }),
        item({ status: 'bought', purchase_price: 20, purchase_date: '2026-02-01' }),
      ],
      ADESSO,
    );
    expect(ledger.months.map((m) => m.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('il capitale fermo e’ solo quello che hai ancora in casa', () => {
    const ledger = buildLedger(
      [
        item({ status: 'bought', purchase_price: 40, purchase_date: '2026-08-01' }),
        item({ status: 'listed', purchase_price: 25, purchase_date: '2026-08-10' }),
        // Venduto: quei soldi sono tornati, non sono piu' fermi.
        item({
          status: 'sold',
          purchase_price: 60,
          purchase_date: '2026-07-01',
          sale_price: 90,
          sale_date: '2026-08-20',
        }),
        // Mai comprato: non ha mai bloccato un euro.
        item({ status: 'passed', purchase_price: null }),
      ],
      ADESSO,
    );

    expect(ledger.lockedUpEur).toBe(65);
    expect(ledger.itemsInStock).toBe(2);
  });

  it('dice da quanto e’ fermo il piu’ vecchio, e quanto ci mette di solito a vendersi', () => {
    const ledger = buildLedger(
      [
        item({ status: 'bought', purchase_price: 10, purchase_date: '2026-08-12' }),
        item({ status: 'bought', purchase_price: 10, purchase_date: '2026-06-11' }),
        item({
          status: 'sold',
          purchase_price: 10,
          purchase_date: '2026-01-01',
          sale_price: 20,
          sale_date: '2026-01-11',
        }),
        item({
          status: 'sold',
          purchase_price: 10,
          purchase_date: '2026-02-01',
          sale_price: 20,
          sale_date: '2026-03-03',
        }),
      ],
      ADESSO,
    );

    expect(ledger.oldestInStockDays).toBe(92);
    // Dieci giorni e trenta: la mediana di due valori e' la loro media.
    expect(ledger.medianDaysToSell).toBe(20);
  });

  it('un venduto senza prezzo non entra da nessuna parte', () => {
    // Meglio un grafico incompleto che uno che somma zeri veri a zeri finti.
    const ledger = buildLedger(
      [item({ status: 'sold', purchase_price: 30, purchase_date: '2026-05-01', sale_price: null })],
      ADESSO,
    );
    expect(ledger.totals.earnedEur).toBe(0);
    expect(ledger.totals.sold).toBe(0);
    expect(ledger.totals.spentEur).toBe(30);
  });
});

describe('quello che ci hai speso sopra', () => {
  it('entra nella spesa del mese dell’acquisto e nel margine della vendita', () => {
    // Pulizia e ricambi escono dalla stessa tasca del prezzo: tenerli fuori
    // faceva sembrare ogni margine piu' alto di quanto fosse.
    const ledger = buildLedger(
      [
        item({
          status: 'sold',
          purchase_price: 30,
          extra_costs: 20,
          purchase_date: '2026-03-14',
          sale_price: 100,
          sale_date: '2026-07-02',
        }),
      ],
      ADESSO,
    );

    expect(ledger.months.find((m) => m.month === '2026-03')!.spentEur).toBe(50);
    expect(ledger.months.find((m) => m.month === '2026-07')!.marginEur).toBe(50);
    expect(ledger.totals.spentEur).toBe(50);
  });

  it('gonfia anche il capitale fermo, perche’ e’ soldo uscito', () => {
    const ledger = buildLedger(
      [item({ status: 'bought', purchase_price: 40, extra_costs: 15, purchase_date: '2026-08-01' })],
      ADESSO,
    );
    expect(ledger.lockedUpEur).toBe(55);
  });

  it('un oggetto senza costi extra conta come prima', () => {
    const ledger = buildLedger(
      [item({ status: 'bought', purchase_price: 40, purchase_date: '2026-08-01' })],
      ADESSO,
    );
    expect(ledger.lockedUpEur).toBe(40);
  });
});

describe('su cosa guadagni', () => {
  const magazzino = [
    // Ceramica: due vendite buone.
    item({ id: 'c1', category: 'ceramica', status: 'sold', purchase_price: 10, purchase_date: '2026-01-05', sale_price: 60, sale_date: '2026-02-01' }),
    item({ id: 'c2', category: 'ceramica', status: 'sold', purchase_price: 20, purchase_date: '2026-01-06', sale_price: 50, sale_date: '2026-02-02' }),
    // Illuminazione: una vendita in perdita.
    item({ id: 'l1', category: 'illuminazione', status: 'sold', purchase_price: 80, purchase_date: '2026-01-07', sale_price: 55, sale_date: '2026-03-01' }),
    // Comprato e mai venduto: entra nella spesa, non nel margine.
    item({ id: 'o1', category: 'orologi', status: 'bought', purchase_price: 40, purchase_date: '2026-08-01' }),
  ];

  it('mette in cima la categoria che rende di piu’', () => {
    const { byCategory } = buildLedger(magazzino, ADESSO);
    expect(byCategory.map((riga) => riga.category)).toEqual([
      'ceramica',
      'orologi',
      'illuminazione',
    ]);
    expect(byCategory[0]!.marginEur).toBe(80);
    expect(byCategory[0]!.roi).toBe(round2(80 / 30));
  });

  it('non conta come margine quello che non hai ancora venduto', () => {
    // E' l'errore che rende inutili quasi tutti i cruscotti di magazzino.
    const orologi = buildLedger(magazzino, ADESSO).byCategory.find((r) => r.category === 'orologi')!;
    expect(orologi.spentEur).toBe(40);
    expect(orologi.marginEur).toBe(0);
    expect(orologi.roi).toBeNull();
    expect(orologi.inStock).toBe(1);
  });

  it('dice quanti di quelli comprati sono poi usciti', () => {
    const { sellThrough } = buildLedger(magazzino, ADESSO);
    expect(sellThrough.bought).toBe(4);
    expect(sellThrough.sold).toBe(3);
    expect(sellThrough.rate).toBe(0.75);
  });

  it('una quota su zero acquisti non esiste', () => {
    expect(buildLedger([], ADESSO).sellThrough.rate).toBeNull();
  });

  it('divide in tre fasce quello che hai ancora in casa', () => {
    const { aging } = buildLedger(
      [
        item({ id: 'a', status: 'bought', purchase_price: 10, purchase_date: '2026-09-01' }),
        item({ id: 'b', status: 'bought', purchase_price: 20, purchase_date: '2026-07-15' }),
        item({ id: 'c', status: 'listed', purchase_price: 30, purchase_date: '2026-02-01' }),
      ],
      ADESSO,
    );
    expect(aging.map((f) => f.items)).toEqual([1, 1, 1]);
    expect(aging[2]!.lockedEur).toBe(30);
  });

  it('il margine cumulato dice se stai andando avanti o indietro', () => {
    // Un mese storto dentro una curva che sale e' un mese storto; lo stesso
    // mese dentro una curva che scende e' un problema, e le barre mensili da
    // sole non lo distinguono.
    const mesi = buildLedger(magazzino, ADESSO).months;
    const febbraio = mesi.find((m) => m.month === '2026-02')!;
    const marzo = mesi.find((m) => m.month === '2026-03')!;
    expect(febbraio.cumulativeMarginEur).toBe(80);
    expect(marzo.marginEur).toBe(-25);
    expect(marzo.cumulativeMarginEur).toBe(55);
  });
});

const round2 = (value: number) => Math.round(value * 100) / 100;
