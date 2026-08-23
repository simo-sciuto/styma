import { describe, expect, it } from 'vitest';

import type { Identification } from '@/schemas/identification';
import type { Comparable, MarketResearch } from '@/schemas/market';
import { valuate } from './valuate';
import { assessFlip } from './flip-score';

const identification: Identification = {
  name: 'Lampada da tavolo',
  category: 'illuminazione',
  brand: 'Artemide',
  model: 'Tolomeo',
  period: 'anni 90',
  materials: ['alluminio'],
  characteristics: ['braccio articolato'],
  markings: ['Artemide Made in Italy'],
  condition: 'good',
  conditionNotes: [],
  history: 'Classico del design italiano.',
  confidence: 0.9,
  confidenceReasons: ['marchio leggibile'],
  marketPace: 'slow',
  imageQuality: 'good',
  missingShots: [],
  searchQueries: ['artemide tolomeo usata'],
};

function comparable(overrides: Partial<Comparable>): Comparable {
  return {
    title: 'Artemide Tolomeo',
    source: 'eBay',
    url: 'https://example.test/1',
    price: 100,
    currency: 'EUR',
    kind: 'sold',
    soldAt: new Date().toISOString().slice(0, 10),
    condition: 'good',
    matchLevel: 'exact_model',
    notes: '',
    ...overrides,
  };
}

function research(comparables: Comparable[]): MarketResearch {
  return { comparables, demand: 'medium', liquidity: 'average', notes: [] };
}

describe('valuate', () => {
  it('non produce una stima quando non ci sono comparabili', () => {
    const valuation = valuate(identification, research([]));
    expect(valuation.available).toBe(false);
  });

  it('scarta i comparabili troppo deboli invece di diluirli nella forbice', () => {
    const valuation = valuate(
      identification,
      research([
        comparable({ url: 'https://example.test/a', price: 100 }),
        comparable({ url: 'https://example.test/b', price: 110 }),
        comparable({
          url: 'https://example.test/c',
          price: 9000,
          matchLevel: 'similar_category',
          kind: 'asking',
          soldAt: null,
          condition: 'poor',
        }),
      ]),
    );

    expect(valuation.available).toBe(true);
    if (!valuation.available) return;
    expect(valuation.used).toHaveLength(2);
    expect(valuation.discarded).toHaveLength(1);
    expect(valuation.high).toBeLessThan(1000);
  });

  it('rifiuta di stimare con un solo comparabile utilizzabile', () => {
    const valuation = valuate(identification, research([comparable({ price: 115 })]));

    expect(valuation.available).toBe(false);
    if (valuation.available) return;
    expect(valuation.reason).toMatch(/troppo poco/i);
  });

  it('non spaccia per certezza la sicurezza del modello su pochi dati', () => {
    const valuation = valuate(
      identification,
      research([
        comparable({ url: 'https://example.test/a', price: 115 }),
        comparable({ url: 'https://example.test/b', price: 115 }),
      ]),
    );

    expect(valuation.available).toBe(true);
    if (!valuation.available) return;
    // identification.confidence e' 0.96 e i due prezzi coincidono:
    // senza il tetto sul campione uscirebbe "confidenza alta".
    expect(valuation.confidence).not.toBe('high');
    // e la forbice non puo' collassare su un punto solo.
    expect(valuation.high).toBeGreaterThan(valuation.low);

    const weak = valuate(
      identification,
      research(
        [110, 115, 120].map((price, index) =>
          comparable({ url: `https://example.test/w${index}`, price, kind: 'asking', soldAt: null }),
        ),
      ),
    );
    expect(weak.available).toBe(true);
    if (!weak.available) return;
    expect(weak.confidence).toBe('low');
  });

  it('restringe la forbice quando i comparabili sono molti', () => {
    const few = valuate(
      identification,
      research(
        [100, 100].map((price, index) => comparable({ price, url: `https://example.test/f${index}` })),
      ),
    );
    const many = valuate(
      identification,
      research(
        Array.from({ length: 10 }, (_, index) =>
          comparable({ price: 100, url: `https://example.test/m${index}` }),
        ),
      ),
    );

    expect(few.available && many.available).toBe(true);
    if (!few.available || !many.available) return;
    expect(many.high - many.low).toBeLessThan(few.high - few.low);
    expect(many.confidenceScore).toBeGreaterThan(few.confidenceScore);
  });

  it('colloca la forbice attorno ai comparabili e resta ordinata', () => {
    const prices = [80, 90, 100, 110, 120];
    const valuation = valuate(
      identification,
      research(prices.map((price, index) => comparable({ price, url: `https://example.test/${index}` }))),
    );

    expect(valuation.available).toBe(true);
    if (!valuation.available) return;
    expect(valuation.low).toBeLessThanOrEqual(valuation.likely);
    expect(valuation.likely).toBeLessThanOrEqual(valuation.high);
    expect(valuation.likely).toBeGreaterThanOrEqual(80);
    expect(valuation.likely).toBeLessThanOrEqual(120);
    expect(valuation.soldCount).toBe(5);
  });

  it('tiene il valore probabile dentro la forbice, non sul bordo', () => {
    // Distribuzione reale osservata in campo: tre vendite molto distanti fra loro.
    const valuation = valuate(
      identification,
      research([
        comparable({ url: 'https://example.test/a', price: 190, source: 'Catawiki' }),
        comparable({ url: 'https://example.test/b', price: 546, condition: 'excellent' }),
        comparable({ url: 'https://example.test/c', price: 690, kind: 'asking', soldAt: null }),
      ]),
    );

    expect(valuation.available).toBe(true);
    if (!valuation.available) return;
    expect(valuation.likely).toBeGreaterThan(valuation.low);
    expect(valuation.likely).toBeLessThan(valuation.high);
  });

  it('abbassa la confidenza quando ci sono solo prezzi richiesti', () => {
    const asking = valuate(
      identification,
      research(
        [80, 100, 120].map((price, index) =>
          comparable({ price, kind: 'asking', soldAt: null, url: `https://example.test/${index}` }),
        ),
      ),
    );
    const sold = valuate(
      identification,
      research(
        [80, 100, 120].map((price, index) => comparable({ price, url: `https://example.test/${index}` })),
      ),
    );

    expect(asking.available && sold.available).toBe(true);
    if (!asking.available || !sold.available) return;
    expect(asking.confidenceScore).toBeLessThan(sold.confidenceScore);
  });
});

describe('assessFlip', () => {
  const valuation = valuate(
    identification,
    research(
      [95, 100, 105, 110].map((price, index) =>
        comparable({ price, url: `https://example.test/${index}` }),
      ),
    ),
  );

  it('non produce raccomandazioni senza una valutazione', () => {
    const empty = valuate(identification, research([]));
    expect(assessFlip(identification, null, empty, 10)).toBeNull();
  });

  it('il punteggio scende al salire del prezzo di acquisto', () => {
    const cheap = assessFlip(identification, research([]), valuation, 10);
    const expensive = assessFlip(identification, research([]), valuation, 90);

    expect(cheap?.atPrice?.score ?? 0).toBeGreaterThan(expensive?.atPrice?.score ?? 0);
  });

  it('le soglie sono coerenti con le raccomandazioni che produce', () => {
    const assessment = assessFlip(identification, research([]), valuation, null);
    expect(assessment).not.toBeNull();
    if (!assessment) return;

    const { buyUpTo, maybeUpTo } = assessment.thresholds;
    expect(buyUpTo).not.toBeNull();
    expect(maybeUpTo).not.toBeNull();
    if (buyUpTo === null || maybeUpTo === null) return;

    expect(buyUpTo).toBeLessThanOrEqual(maybeUpTo);
    expect(assessFlip(identification, research([]), valuation, buyUpTo)?.atPrice?.recommendation).toBe(
      'BUY',
    );
    expect(
      assessFlip(identification, research([]), valuation, maybeUpTo + 5)?.atPrice?.recommendation,
    ).toBe('PASS');
  });
});

describe('annunci attivi e dati fuori scala', () => {
  const listing = (price: number, overrides: Partial<Comparable> = {}): Comparable => ({
    title: `Canon AE-1 a ${price}`,
    source: 'Subito',
    url: `https://subito.it/${price}`,
    price,
    currency: 'EUR',
    kind: 'asking',
    soldAt: null,
    condition: 'unknown',
    matchLevel: 'same_family',
    notes: '',
    ...overrides,
  });

  const market = (comparables: Comparable[]): MarketResearch => ({
    comparables,
    demand: 'medium',
    liquidity: 'average',
    notes: [],
  });

  it('usa gli annunci senza data invece di scartarli', () => {
    // Prima valevano 0,185 di peso e finivano tutti nel cestino: sette Canon
    // AE-1 in vendita producevano "non lo so".
    const result = valuate(
      identification,
      market([listing(75), listing(100), listing(150), listing(150), listing(170), listing(190)]),
    );

    expect(result.available).toBe(true);
  });

  it('sconta i prezzi richiesti invece di prenderli per buoni', () => {
    const result = valuate(identification, market([listing(200), listing(200), listing(200)]));

    expect(result.available).toBe(true);
    if (!result.available) return;
    // 200 richiesti non sono 200 incassati.
    expect(result.likely).toBeLessThan(200);
    expect(result.likely).toBeGreaterThan(100);
  });

  it('non supera mai "low" senza una vendita confermata', () => {
    const many = Array.from({ length: 10 }, () => listing(150, { matchLevel: 'exact_model' }));
    const result = valuate(identification, market(many));

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.confidence).toBe('low');
  });

  it('scarta un prezzo fuori scala invece di lasciarlo spostare la media', () => {
    // Il caso vero: un'Olivetti Valentine aggiudicata a 45.000 GBP fra
    // comparabili da poche centinaia di euro.
    const sane = [listing(400), listing(450), listing(500), listing(550)];
    const withOutlier = valuate(identification, market([...sane, listing(52000)]));
    const withoutOutlier = valuate(identification, market(sane));

    expect(withOutlier.available).toBe(true);
    expect(withoutOutlier.available).toBe(true);
    if (!withOutlier.available || !withoutOutlier.available) return;

    expect(withOutlier.likely).toBeCloseTo(withoutOutlier.likely, 0);
    expect(withOutlier.discarded.some((entry) => /fuori scala/.test(entry.reason))).toBe(true);
  });

  it('non scarta nulla sotto tre punti: non si sa quale sia quello sbagliato', () => {
    // Con due soli prezzi il campione e' comunque troppo esile per una forbice;
    // quello che si verifica qui e' che nessuno dei due venga bollato come
    // errore, perche' non c'e' modo di sapere quale lo sia.
    const result = valuate(identification, market([listing(100), listing(50000)]));

    expect(result.discarded.some((entry) => /fuori scala/.test(entry.reason))).toBe(false);
  });

  it('il valore probabile resta dentro la forbice', () => {
    const result = valuate(
      identification,
      market([listing(80), listing(120), listing(600, { matchLevel: 'exact_model' })]),
    );

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.likely).toBeGreaterThanOrEqual(result.low);
    expect(result.likely).toBeLessThanOrEqual(result.high);
  });
});

describe('oggetti senza marca ne’ modello', () => {
  const categoryMatch = (price: number, index: number): Comparable => ({
    title: `Vaso ceramica fat lava ${index}`,
    source: 'eBay',
    url: `https://ebay.it/itm/v${index}`,
    price,
    currency: 'EUR',
    kind: 'asking',
    soldAt: null,
    condition: 'unknown',
    // Senza marca ne' modello nel titolo, e' tutto cio' che si puo' dedurre.
    matchLevel: 'similar_category',
    notes: '',
  });

  const market = (comparables: Comparable[]): MarketResearch => ({
    comparables,
    demand: 'unknown',
    liquidity: 'unknown',
    notes: [],
  });

  const anonimo: Identification = { ...identification, brand: null, model: null, confidence: 0.55 };

  it('usa gli annunci di categoria invece di lasciare "non lo so"', () => {
    // Il caso vero: un vaso senza punzone, diciannove annunci trovati e tutti
    // scartati perche' similar_category x asking cade sotto la soglia.
    const found = [40, 55, 60, 65, 70, 90].map(categoryMatch);
    const result = valuate(anonimo, market(found));

    expect(result.available).toBe(true);
  });

  it('lo dichiara, e resta al minimo della confidenza', () => {
    const result = valuate(anonimo, market([40, 55, 60, 65, 70, 90].map(categoryMatch)));

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.confidence).toBe('low');
    expect(result.reasons.join(' ')).toMatch(/stessa categoria, non dello stesso modello/);
  });

  it('non ripesca i deboli quando c’e’ di meglio', () => {
    // Due buoni, perche' uno solo non fa comunque una forbice.
    const buoni: Comparable[] = [200, 220].map((price, index) => ({
      ...categoryMatch(price, 90 + index),
      matchLevel: 'exact_model' as const,
      condition: 'good' as const,
    }));
    const result = valuate(anonimo, market([...buoni, ...[10, 12].map(categoryMatch)]));

    expect(result.available).toBe(true);
    if (!result.available) return;
    // I due deboli restano fuori: la soglia serve proprio a preferire il buono.
    expect(result.used.every((entry) => entry.comparable.matchLevel === 'exact_model')).toBe(true);
  });

  it('quando non basta comunque, dice cosa ha visto', () => {
    // Un solo annuncio non fa una forbice, ma tacere il prezzo osservato
    // lascia chi e' davanti al banco esattamente dove stava.
    const result = valuate(anonimo, market([categoryMatch(80, 1)]));

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.observed).toMatchObject({ count: 1, lowEur: 80, highEur: 80 });
  });

  it('senza nessun annuncio non inventa nemmeno quello', () => {
    const result = valuate(anonimo, market([]));

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.observed).toBeNull();
  });
});
