import { describe, expect, it } from 'vitest';

import { buildLedger } from './ledger';
import { flipConfig } from '@/services/valuation/config';
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

  it('il margine sta nel mese della vendita, ed e’ al netto delle commissioni', () => {
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
    expect(luglio.marginEur).toBe(100 - 100 * flipConfig.marketplaceFeeRate - 30);
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
