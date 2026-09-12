import { describe, expect, it } from 'vitest';

import type { Outcome } from './outcome';
import { viewOutcome } from './outcome-view';

/**
 * Lo spazio fra la cifra e l'euro e' unificatore (U+00A0), non uno spazio.
 * Lo mette `Intl`, ed e' giusto: «30» e «€» non vanno divisi a fine riga. Ma
 * un carattere invisibile dentro una stringa attesa e' un test che fallisce
 * mostrando due righe identiche, quindi qui si normalizza prima di confrontare.
 */
function piano(testo: string): string {
  return testo.replace(/\u00a0/g, ' ');
}

/** Un oggetto in magazzino, con tutto a posto: i casi lo smontano da qui. */
function inMagazzino(patch: Partial<Extract<Outcome, { kind: 'holding' }>> = {}) {
  return {
    kind: 'holding' as const,
    askingPrice: 30,
    purchasePrice: 25,
    extraCosts: null,
    extraCostsNote: null,
    negotiated: 5,
    listed: false,
    daysHeld: 12,
    daysOnMarket: null,
    likelyValue: 90,
    ...patch,
  };
}

describe('la scatola dell’esito', () => {
  it('chiede se l’hai comprato, col prezzo del banco dentro', () => {
    const vista = viewOutcome({ kind: 'open' }, 30);
    expect(vista.stato).toBe('Da decidere');
    expect(piano(vista.frase)).toContain('l’hai comprato?');
    // Senza acquisto non c'e' ancora niente da contare: due caselle vuote
    // sarebbero due caselle che insegnano a saltare la riga in cui stanno.
    expect(vista.figure).toEqual([]);
  });

  it('conta le spese dentro quanto ti e’ costato', () => {
    // 25 pagati piu' 10 di ricambi: il guadagno atteso e' 90 − 35, non 90 − 25.
    // Tenere le spese fuori fa sembrare ogni margine piu' grande di quello che e'.
    const vista = viewOutcome(inMagazzino({ extraCosts: 10, extraCostsNote: 'ricambi' }), 30);
    expect(piano(vista.figure[0].value)).toBe('35 €');
    expect(piano(vista.figure[1].value)).toBe('+55 €');
    expect(vista.figure[1].tone).toBe('good');
    expect(piano(vista.dettagli ?? '')).toBe('5 € strappati trattando, 10 € di spese (ricambi).');
  });

  it('in magazzino guarda avanti: quanto ne fai se lo vendi', () => {
    const vista = viewOutcome(inMagazzino(), 30);
    expect(vista.stato).toBe('In magazzino');
    expect(piano(vista.frase)).toBe('Ti e’ costato 25 €, ce l’hai da 12 giorni.');
    expect(piano(vista.figure[1].label)).toBe('Venduto a 90 €');
    expect(piano(vista.figure[1].value)).toBe('+65 €');
  });

  it('dice che ci rimetti, quando ci rimetti', () => {
    // Il caso che nessuno vuole vedere e che va visto: pagato piu' di quanto
    // vale. Se la cifra uscisse verde col segno piu', la scatola mentirebbe.
    const vista = viewOutcome(inMagazzino({ purchasePrice: 120, negotiated: null }), 30);
    expect(piano(vista.figure[1].value)).toBe('-30 €');
    expect(vista.figure[1].tone).toBe('bad');
  });

  it('senza prezzo di acquisto non inventa un conto', () => {
    // Comprato, ma quanto non l'hai detto: due caselle su un numero che non
    // c'e' sarebbero due caselle inventate.
    const vista = viewOutcome(
      inMagazzino({ purchasePrice: null, negotiated: null, daysHeld: 1 }),
      30,
    );
    expect(piano(vista.frase)).toBe('L’hai comprato, ce l’hai da 1 giorno.');
    expect(vista.figure).toEqual([]);
  });

  it('la frase regge anche senza la subordinata', () => {
    // E' il punto in cui la versione prima di questa si rompeva: i due pezzi
    // venivano concatenati a mano, e senza il secondo la riga usciva attaccata.
    const vista = viewOutcome(inMagazzino({ daysHeld: null }), 30);
    expect(piano(vista.frase)).toBe('Ti e’ costato 25 €.');
  });

  it('in vendita cambia stato e conta i giorni sul mercato', () => {
    const vista = viewOutcome(inMagazzino({ listed: true, daysOnMarket: 3 }), 30);
    expect(vista.stato).toBe('In vendita');
    expect(piano(vista.frase)).toBe('Ti e’ costato 25 €, in vendita da 3 giorni.');
  });

  it('a vendita fatta il guadagno e’ successo, e la stima si fa giudicare', () => {
    const vista = viewOutcome(
      {
        kind: 'sold',
        askingPrice: 30,
        purchasePrice: 25,
        negotiated: 5,
        salePrice: 90,
        marketplace: 'Vinted',
        grossMargin: 65,
        extraCosts: null,
        extraCostsNote: null,
        daysHeld: 20,
        daysOnMarket: 12,
        vsEstimate: { verdict: 'inside', low: 80, high: 120, likely: 90 },
      },
      30,
    );
    expect(vista.stato).toBe('Venduto');
    expect(piano(vista.frase)).toBe('L’hai venduto a 90 € su Vinted, dopo 12 giorni.');
    expect(piano(vista.figure[1].label)).toBe('Ci hai guadagnato');
    expect(piano(vista.figure[1].value)).toBe('+65 €');
    expect(vista.stima?.centrata).toBe(true);
  });

  it('quando la stima sbagliava lo dice con lo stesso rilievo', () => {
    const vista = viewOutcome(
      {
        kind: 'sold',
        askingPrice: null,
        purchasePrice: 25,
        negotiated: null,
        salePrice: 200,
        marketplace: null,
        grossMargin: 175,
        extraCosts: null,
        extraCostsNote: null,
        daysHeld: null,
        daysOnMarket: null,
        vsEstimate: { verdict: 'above', low: 80, high: 120, likely: 90 },
      },
      null,
    );
    expect(piano(vista.frase)).toBe('L’hai venduto a 200 €.');
    expect(vista.stima?.centrata).toBe(false);
    expect(piano(vista.stima?.testo ?? '')).toContain('sottovalutato');
  });

  it('un «lascia stare» resta una decisione registrata, non un vuoto', () => {
    const vista = viewOutcome({ kind: 'passed', askingPrice: 30 }, 30);
    expect(vista.stato).toBe('Lasciato li’');
    expect(piano(vista.frase)).toBe('Ne chiedevano 30 € e non l’hai preso.');
  });
});
