import { describe, expect, it } from 'vitest';

import type { Comparable, MarketResearch } from '@/schemas/market';
import type { Valuation } from '@/schemas/analysis';
import { valuate } from './valuate';
import {
  assessFlip,
  effectiveWeights,
  priceThresholds,
  recommendationAt,
  riskBufferRate,
} from './flip-score';
import { flipConfig } from './config';
import { anIdentification } from '@/schemas/testing';

const identification = anIdentification({
  name: 'Lampada da tavolo',
  objectType: 'lampada da tavolo',
  category: 'illuminazione',
  brand: 'Artemide',
  model: 'Tolomeo',
  period: 'anni 90',
  materials: ['alluminio'],
});

function comparable(overrides: Partial<Comparable>): Comparable {
  return {
    title: 'Artemide Tolomeo',
    source: 'eBay',
    url: 'https://example.test/1',
    price: 100,
    currency: 'EUR',
    kind: 'asking',
    soldAt: null,
    condition: 'good',
    matchLevel: 'exact_model',
    notes: '',
    ...overrides,
  };
}

function research(overrides: Partial<MarketResearch> = {}): MarketResearch {
  return {
    comparables: [95, 100, 105, 110].map((price, index) =>
      comparable({ price, url: `https://example.test/${index}` }),
    ),
    demand: 'unknown',
    liquidity: 'unknown',
    notes: [],
    ...overrides,
  };
}

/** Una valutazione disponibile, costruita dal motore vero e non a mano. */
function available(input: MarketResearch = research()): Extract<Valuation, { available: true }> {
  const valuation = valuate(identification, input);
  if (!valuation.available) throw new Error('la valutazione doveva essere disponibile');
  return valuation;
}

describe('pesi effettivi del punteggio', () => {
  it('senza domanda ne’ liquidita’ osservate, il peso della liquidita’ si ridistribuisce', () => {
    // Il caso di sempre: eBay da' inserzioni e prezzi, non domanda. Lasciare
    // pesare un quarto del punteggio a un valore costante regalava dodici
    // punti e mezzo a chiunque.
    const weights = effectiveWeights(research({ demand: 'unknown', liquidity: 'unknown' }));

    expect(weights.liquidity).toBe(0);
    expect(weights.profit + weights.confidence).toBeCloseTo(1, 10);
    // In proporzione a quanto pesavano gia': 0.5 e 0.25 stavano due a uno.
    expect(weights.profit / weights.confidence).toBeCloseTo(2, 10);
  });

  it('quando il mercato e’ stato osservato i pesi restano quelli configurati', () => {
    const weights = effectiveWeights(research({ demand: 'high', liquidity: 'fast' }));
    expect(weights).toEqual(flipConfig.scoreWeights);
  });

  it('basta uno dei due segnali per tenere il peso', () => {
    // Se la domanda e' nota ma la liquidita' no, qualcosa sul mercato lo
    // sappiamo: e' diverso dal non aver guardato affatto.
    expect(effectiveWeights(research({ demand: 'high', liquidity: 'unknown' })).liquidity).toBe(
      flipConfig.scoreWeights.liquidity,
    );
  });

  it('senza ricerca del tutto si comporta come senza osservazioni', () => {
    expect(effectiveWeights(null).liquidity).toBe(0);
  });

  it('un affare senza margine e senza affidabilita’ vale zero, non dodici', () => {
    // Il punto della ridistribuzione. Con la liquidita' bloccata a 0,5 il suo
    // quarto di peso regalava 12,5 punti anche a un oggetto su cui non
    // sapevamo niente e su cui non si guadagnava niente: il punteggio non
    // poteva scendere sotto quella soglia ne' salire sopra 87,5.
    const senzaNulla = { ...available(), confidenceScore: 0 };
    const assessment = assessFlip(identification, research(), senzaNulla, 500);
    expect(assessment?.atPrice?.score).toBe(0);
  });
});

describe('cuscinetto di rischio', () => {
  it('cresce quando la stima e’ meno affidabile', () => {
    const solida = available();
    const alta = riskBufferRate({ ...solida, confidence: 'high', dispersion: 0 }, identification);
    const media = riskBufferRate({ ...solida, confidence: 'medium', dispersion: 0 }, identification);
    const bassa = riskBufferRate({ ...solida, confidence: 'low', dispersion: 0 }, identification);

    expect(alta).toBeLessThan(media);
    expect(media).toBeLessThan(bassa);
  });

  it('cresce con la dispersione dei prezzi', () => {
    const valuation = available();
    const compatti = riskBufferRate({ ...valuation, confidence: 'high', dispersion: 0 }, identification);
    const sparsi = riskBufferRate({ ...valuation, confidence: 'high', dispersion: 1 }, identification);
    expect(sparsi).toBeGreaterThan(compatti);
  });

  it('cresce con uno stato di conservazione problematico', () => {
    const valuation = { ...available(), confidence: 'high' as const, dispersion: 0 };
    const buono = riskBufferRate(valuation, identification);
    const scarso = riskBufferRate(valuation, { ...identification, condition: 'poor' });
    expect(scarso).toBeGreaterThan(buono);
  });

  it('non supera il tetto, nemmeno sommando tutto il peggio', () => {
    const peggio = { ...available(), confidence: 'low' as const, dispersion: 1 };
    const rate = riskBufferRate(peggio, { ...identification, condition: 'poor' });
    expect(rate).toBeLessThanOrEqual(flipConfig.riskBuffer.cap);
  });
});

describe('prezzo massimo, riga per riga', () => {
  it('le righe tornano a mente', () => {
    // E' il punto di tutta la riscrittura. Prima il prezzo massimo usciva da
    // una bisezione su un punteggio composito: coerente, ma impossibile da
    // verificare per chi lo legge.
    const thresholds = priceThresholds(available(), identification);
    const b = thresholds.breakdown;

    const copertura = b.expectedSalePrice - b.fees - b.shipping - b.riskBuffer;
    expect(thresholds.maybeUpTo).toBe(Math.floor(copertura));
    // venduto − commissioni − spedizione − cuscinetto − guadagno = massimo
    expect(thresholds.buyUpTo).toBe(Math.round(copertura - b.targetProfit));
  });

  it('chiede lo stesso ritorno su un oggetto da 40 € e su uno da 500', () => {
    /*
     * Il difetto che ha reso il prodotto incomprensibile: il guadagno era una
     * quota del *venduto*, e la spedizione — 9 €, uguale a ogni prezzo — si
     * toglieva prima. Risultato: su una fascia 30–70 € l'app chiedeva un
     * ritorno del 163% per dire "compralo", su una 400–800 € il 95%. Chi
     * leggeva vedeva "vale 30–70" e "paga fino a 12", e i due numeri
     * sembravano darsi torto a vicenda.
     */
    const ritorno = (low: number, likely: number, high: number) => {
      const valuation = { ...available(), low, likely, high, confidence: 'medium' as const };
      const { buyUpTo, breakdown } = priceThresholds(valuation, identification);
      // Il guadagno tenuto da parte a quel prezzo, sul prezzo stesso. Quello
      // che incassi davvero e' di piu': il cuscinetto di rischio non e' un
      // costo, e' una cifra che ti tieni indietro per sicurezza.
      return breakdown.targetProfit / buyUpTo!;
    };

    const piccolo = ritorno(30, 45, 70);
    const medio = ritorno(80, 110, 150);
    const grande = ritorno(400, 550, 800);

    for (const r of [piccolo, medio, grande]) {
      expect(r).toBeGreaterThan(flipConfig.dealRoi * 0.9);
      expect(r).toBeLessThan(flipConfig.dealRoi * 1.15);
    }
    // La distanza fra il piu' piccolo e il piu' grande e' quella
    // dell'arrotondamento all'euro, non quella fra il 163% e il 95%.
    expect(Math.abs(piccolo - grande)).toBeLessThan(0.06);
  });

  it('la soglia dell’affare sta sempre sotto quella della trattativa', () => {
    const thresholds = priceThresholds(available(), identification);
    expect(thresholds.buyUpTo).not.toBeNull();
    expect(thresholds.maybeUpTo).not.toBeNull();
    expect(thresholds.buyUpTo!).toBeLessThan(thresholds.maybeUpTo!);
  });

  it('una stima fragile abbassa il prezzo massimo', () => {
    const valuation = available();
    const solida = priceThresholds({ ...valuation, confidence: 'high', dispersion: 0 }, identification);
    const fragile = priceThresholds({ ...valuation, confidence: 'low', dispersion: 0 }, identification);

    expect(fragile.buyUpTo!).toBeLessThan(solida.buyUpTo!);
    // Chi paga quel prezzo non sta scommettendo sulla nostra confidenza:
    // l'incertezza si paga in prezzo, non in rischio scaricato addosso.
    expect(fragile.breakdown.riskBuffer).toBeGreaterThan(solida.breakdown.riskBuffer);
  });

  it('su un oggetto che non copre nemmeno la spedizione non inventa una soglia', () => {
    const magro = available(
      research({ comparables: [10, 11, 12, 13].map((price, i) => comparable({ price, url: `https://x.test/${i}` })) }),
    );
    const thresholds = priceThresholds(magro, identification);

    // Con 9 € di spedizione su una stima da ~11 €, non esiste un prezzo di
    // acquisto che regga: dirlo e' la risposta giusta, non un numero minimo.
    expect(thresholds.buyUpTo).toBeNull();
  });
});

describe('il verdetto e’ la fascia, non una seconda lettura del punteggio', () => {
  it('assegna la fascia giusta ai bordi', () => {
    const thresholds = priceThresholds(available(), identification);
    const buy = thresholds.buyUpTo!;
    const maybe = thresholds.maybeUpTo!;

    expect(recommendationAt(buy, thresholds)).toBe('BUY');
    expect(recommendationAt(buy + 1, thresholds)).toBe('MAYBE');
    expect(recommendationAt(maybe, thresholds)).toBe('MAYBE');
    expect(recommendationAt(maybe + 1, thresholds)).toBe('PASS');
  });

  it('senza nessuna soglia utilizzabile qualunque prezzo e’ un no', () => {
    const nessuna = { buyUpTo: null, maybeUpTo: null, breakdown: { expectedSalePrice: 0, fees: 0, shipping: 0, riskBuffer: 0, targetProfit: 0 } };
    expect(recommendationAt(0, nessuna)).toBe('PASS');
  });

  it('non contraddice mai il prezzo massimo che mostra accanto', () => {
    // La ragione per cui il verdetto ha smesso di uscire dal punteggio:
    // poteva dire COMPRALO sopra un prezzo piu' alto del massimo consigliato
    // stampato due righe sotto.
    const valuation = available();
    const thresholds = priceThresholds(valuation, identification);

    for (let price = 0; price <= 120; price += 1) {
      const verdict = assessFlip(identification, research(), valuation, price)?.atPrice?.recommendation;
      if (verdict === 'BUY') expect(price).toBeLessThanOrEqual(thresholds.buyUpTo!);
      if (verdict === 'MAYBE') expect(price).toBeLessThanOrEqual(thresholds.maybeUpTo!);
      if (verdict === 'PASS') expect(price).toBeGreaterThan(thresholds.maybeUpTo!);
    }
  });

  it('dichiara fra i fattori che domanda e tempi non sono stati osservati', () => {
    const assessment = assessFlip(identification, research(), available(), 10);
    const labels = assessment!.factors.map((factor) => factor.label);
    expect(labels.some((label) => label.includes('non osservati'))).toBe(true);
  });
});
