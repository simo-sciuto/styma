import type { ItemRow } from './types';

/**
 * Il conto economico del magazzino, mese per mese.
 *
 * L'inventario dice quanti oggetti hai e quanto valgono; questo dice se stai
 * guadagnando, che e' una domanda diversa e l'unica che decide se vale la pena
 * continuare. Sono gli stessi dati gia' caricati per la lista: nessuna query in
 * piu', nessuna colonna nuova.
 *
 * Due regole che sembrano dettagli e non lo sono.
 *
 * **Le spese vanno al mese in cui hai pagato, gli incassi al mese in cui hai
 * venduto.** Un oggetto comprato a marzo e venduto a luglio pesa su marzo per
 * quello che e' uscito e su luglio per quello che e' entrato: e' come si
 * muovono i soldi davvero. Attribuire tutto al mese della vendita farebbe
 * sembrare marzo un mese senza spese, che e' esattamente il mese in cui hai
 * svuotato il portafoglio.
 *
 * **Il margine invece appartiene alla vendita.** E' l'unico modo di legarlo
 * all'oggetto giusto: incasso, meno le commissioni su quell'incasso, meno
 * quello che quell'oggetto era costato. Un mese di soli acquisti ha margine
 * zero, non margine negativo: non hai perso niente, hai comprato.
 *
 * Il margine e' incasso meno quello che quell'oggetto era costato: la stessa
 * aritmetica del verdetto di ogni singolo oggetto. Se qui uscisse da un altro
 * conto, due schermate dello stesso prodotto direbbero due cose diverse.
 */
export type MonthlyLedger = {
  /** "2026-09". Ordinabile come stringa, che e' tutto quello che serve. */
  month: string;
  spentEur: number;
  earnedEur: number;
  /** Incassato meno quanto erano costati gli oggetti venduti. */
  marginEur: number;
  bought: number;
  sold: number;
};

export type Ledger = {
  /** I mesi in ordine, senza buchi: un mese vuoto in mezzo e' un'informazione. */
  months: MonthlyLedger[];
  totals: {
    spentEur: number;
    earnedEur: number;
    marginEur: number;
    bought: number;
    sold: number;
  };
  /**
   * Quanto hai pagato per la roba che hai ancora in casa. Non e' una perdita e
   * non e' un guadagno: e' il soldo che non puoi spendere di nuovo finche' non
   * la vendi, e per chi rivende e' il vincolo vero.
   */
  lockedUpEur: number;
  itemsInStock: number;
  /** Quanto ci mette, in media, un oggetto a passare da comprato a venduto. */
  medianDaysToSell: number | null;
  /**
   * Il piu' vecchio ancora in magazzino, in giorni. Un solo numero, ma e' la
   * riga che dice se il magazzino sta diventando un ripostiglio.
   */
  oldestInStockDays: number | null;
};

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Tutti i mesi da `first` a `last` compresi, cosi' un mese vuoto resta visibile. */
function monthRange(first: string, last: string): string[] {
  const months: string[] = [];
  let [year, month] = first.split('-').map(Number) as [number, number];
  const [lastYear, lastMonth] = last.split('-').map(Number) as [number, number];

  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/**
 * Giorni interi trascorsi. `floor` e non `round`: un oggetto comprato stamattina
 * e' fermo da zero giorni, non da uno, e a mezzogiorno non ne diventano due.
 */
function daysBetween(from: string, to: Date): number {
  const start = new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((to.getTime() - start) / 86_400_000));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

const round = (value: number) => Math.round(value * 100) / 100;

export function buildLedger(items: ItemRow[], now: Date = new Date()): Ledger {
  const perMonth = new Map<string, MonthlyLedger>();

  const bucket = (month: string): MonthlyLedger => {
    const existing = perMonth.get(month);
    if (existing) return existing;
    const created: MonthlyLedger = {
      month,
      spentEur: 0,
      earnedEur: 0,
      marginEur: 0,
      bought: 0,
      sold: 0,
    };
    perMonth.set(month, created);
    return created;
  };

  let lockedUpEur = 0;
  let itemsInStock = 0;
  const daysToSell: number[] = [];
  let oldestInStockDays: number | null = null;

  for (const item of items) {
    const paid = item.purchase_price;
    const sold = item.status === 'sold';

    if (paid !== null && item.purchase_date) {
      const month = bucket(monthOf(item.purchase_date));
      month.spentEur += paid;
      month.bought += 1;
    }

    if (sold && item.sale_price !== null && item.sale_date) {
      const month = bucket(monthOf(item.sale_date));
      month.earnedEur += item.sale_price;
      month.sold += 1;
      // Il margine sta nel mese della vendita anche quando la spesa stava in
      // un altro: e' il momento in cui si scopre se quell'acquisto era buono.
      month.marginEur += item.sale_price - (paid ?? 0);

      if (item.purchase_date) {
        daysToSell.push(daysBetween(item.purchase_date, new Date(item.sale_date)));
      }
    }

    // In magazzino: comprato e non ancora venduto. `found` e `passed` non ci
    // sono mai stati, e vanno tenuti fuori dal capitale fermo.
    if (!sold && paid !== null && (item.status === 'bought' || item.status === 'listed')) {
      lockedUpEur += paid;
      itemsInStock += 1;
      if (item.purchase_date) {
        const days = daysBetween(item.purchase_date, now);
        if (oldestInStockDays === null || days > oldestInStockDays) oldestInStockDays = days;
      }
    }
  }

  const known = [...perMonth.keys()].sort();
  const months =
    known.length === 0
      ? []
      : monthRange(known[0]!, known[known.length - 1]!).map(
          (month) =>
            perMonth.get(month) ?? {
              month,
              spentEur: 0,
              earnedEur: 0,
              marginEur: 0,
              bought: 0,
              sold: 0,
            },
        );

  for (const month of months) {
    month.spentEur = round(month.spentEur);
    month.earnedEur = round(month.earnedEur);
    month.marginEur = round(month.marginEur);
  }

  return {
    months,
    totals: {
      spentEur: round(months.reduce((sum, m) => sum + m.spentEur, 0)),
      earnedEur: round(months.reduce((sum, m) => sum + m.earnedEur, 0)),
      marginEur: round(months.reduce((sum, m) => sum + m.marginEur, 0)),
      bought: months.reduce((sum, m) => sum + m.bought, 0),
      sold: months.reduce((sum, m) => sum + m.sold, 0),
    },
    lockedUpEur: round(lockedUpEur),
    itemsInStock,
    medianDaysToSell: median(daysToSell),
    oldestInStockDays,
  };
}
