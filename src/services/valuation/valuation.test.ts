import { describe, expect, it } from 'vitest';

import type { Identification } from '@/schemas/identification';
import type { Comparable, MarketResearch } from '@/schemas/market';
import { valuate } from './valuate';
import { assessFlip } from './flip-score';

const identification: Identification = {
  name: 'Lampada da tavolo',
  objectType: 'lampada da tavolo',
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

/**
 * Default coerente con cio' che il prodotto trova davvero: un'inserzione
 * attiva dello stesso modello. `kind`/`soldAt` restano nello schema ma non
 * influenzano piu' il calcolo — vedi la nota in valuate.ts.
 */
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

function research(comparables: Comparable[]): MarketResearch {
  return { comparables, demand: 'medium', liquidity: 'average', notes: [] };
}

describe('valuate', () => {
  it('non produce una stima quando non ci sono comparabili', () => {
    const valuation = valuate(identification, research([]));
    expect(valuation.available).toBe(false);
  });

  it('scarta i comparabili troppo deboli invece di diluirli nella fascia', () => {
    const valuation = valuate(
      identification,
      research([
        comparable({ url: 'https://example.test/a', price: 100 }),
        comparable({ url: 'https://example.test/b', price: 110 }),
        comparable({
          url: 'https://example.test/c',
          price: 9000,
          matchLevel: 'similar_category',
          condition: 'poor',
        }),
      ]),
    );

    expect(valuation.available).toBe(true);
    if (!valuation.available) return;
    // I due dello stesso modello bastano da soli: il terzo, che non lo e',
    // resta fuori anche se il suo peso individuale avrebbe retto.
    expect(valuation.comparableTier).toBe('identical');
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
    // identification.confidence e' 0.9 e i due prezzi coincidono: senza il
    // tetto sul campione uscirebbe "confidenza alta" da soli due punti.
    expect(valuation.confidence).not.toBe('high');
    // e la fascia non puo' collassare su un punto solo.
    expect(valuation.high).toBeGreaterThan(valuation.low);

    const fewer = valuate(
      identification,
      research(
        [110, 115, 120].map((price, index) =>
          comparable({ url: `https://example.test/w${index}`, price }),
        ),
      ),
    );
    expect(fewer.available).toBe(true);
    if (!fewer.available) return;
    // Tre punti concordi non bastano comunque per "high": il tetto sul
    // campione (sotto una certa soglia di comparabili) vale a prescindere
    // da quanto sono d'accordo fra loro.
    expect(fewer.confidence).not.toBe('high');
  });

  it('restringe la fascia quando i comparabili sono molti', () => {
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

  it('colloca la fascia attorno ai comparabili e resta ordinata', () => {
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
    expect(valuation.identicalCount).toBe(5);
  });

  it('tiene il valore probabile dentro la fascia, non sul bordo', () => {
    // Distribuzione reale osservata in campo: tre annunci molto distanti fra loro.
    const valuation = valuate(
      identification,
      research([
        comparable({ url: 'https://example.test/a', price: 190, source: 'Catawiki' }),
        comparable({ url: 'https://example.test/b', price: 546, condition: 'excellent' }),
        comparable({ url: 'https://example.test/c', price: 690 }),
      ]),
    );

    expect(valuation.available).toBe(true);
    if (!valuation.available) return;
    expect(valuation.likely).toBeGreaterThan(valuation.low);
    expect(valuation.likely).toBeLessThan(valuation.high);
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

describe('livello identical / similar / weak', () => {
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
    // Un annuncio attivo non ha soldAt perche' non e' ancora una vendita, non
    // perche' sia vecchio: sei Canon AE-1 in vendita producono comunque una stima.
    const result = valuate(
      identification,
      market([listing(75), listing(100), listing(150), listing(150), listing(170), listing(190)]),
    );

    expect(result.available).toBe(true);
  });

  it('con abbastanza annunci dello stesso modello, la confidenza arriva a "high"', () => {
    // Deciso il 2026-09-09: la stima si basa solo su prezzi richiesti, non su
    // vendite confermate — nessuna fonte gratuita le dice. Cio' che conta
    // allora e' se il modello e' davvero lo stesso, non se e' stato venduto.
    // Un campione ampio e concorde di oggetti identici puo' arrivare a "high".
    const many = Array.from({ length: 40 }, () => listing(150, { matchLevel: 'exact_model' }));
    const result = valuate(identification, market(many));

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.comparableTier).toBe('identical');
    expect(result.confidence).toBe('high');
  });

  it('senza annunci dello stesso modello non supera mai "medium"', () => {
    // Stesso campione, ma nessuno e' lo stesso identico modello: restano
    // marca o famiglia vicina. Per quanto siano numerosi e concordi, non e'
    // piu' lo stesso oggetto, e "high" affermerebbe una precisione che i
    // dati non hanno.
    const many = Array.from({ length: 40 }, () => listing(150, { matchLevel: 'same_family' }));
    const result = valuate(identification, market(many));

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.comparableTier).toBe('similar');
    expect(result.confidence).not.toBe('high');
  });

  it('preferisce gli annunci dello stesso modello quando bastano da soli', () => {
    const mixed = [
      ...Array.from({ length: 5 }, (_, i) => listing(150 + i, { matchLevel: 'exact_model' })),
      ...Array.from({ length: 5 }, (_, i) => listing(400 + i, { matchLevel: 'same_brand' })),
    ];
    const result = valuate(identification, market(mixed));

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.comparableTier).toBe('identical');
    expect(result.used.every((entry) => entry.comparable.matchLevel === 'exact_model')).toBe(true);
    // Il prezzo riflette solo gli identici: la fascia non si sposta verso i 400+.
    expect(result.high).toBeLessThan(300);
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
    // Con due soli prezzi il campione e' comunque troppo esile per una fascia;
    // quello che si verifica qui e' che nessuno dei due venga bollato come
    // errore, perche' non c'e' modo di sapere quale lo sia.
    const result = valuate(identification, market([listing(100), listing(50000)]));

    expect(result.discarded.some((entry) => /fuori scala/.test(entry.reason))).toBe(false);
  });

  it('il valore probabile resta dentro la fascia', () => {
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
  const categoryMatch = (price: number, index: number, overrides: Partial<Comparable> = {}): Comparable => ({
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
    ...overrides,
  });

  const market = (comparables: Comparable[]): MarketResearch => ({
    comparables,
    demand: 'unknown',
    liquidity: 'unknown',
    notes: [],
  });

  const anonimo: Identification = { ...identification, brand: null, model: null, confidence: 0.55 };

  it('usa gli annunci di categoria invece di lasciare "non lo so"', () => {
    // Il caso vero: un vaso senza punzone, sei annunci trovati, nessuno dello
    // stesso modello — ma sono comunque dati reali, non si butta via nulla.
    const found = [40, 55, 60, 65, 70, 90].map((price, i) => categoryMatch(price, i));
    const result = valuate(anonimo, market(found));

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.comparableTier).toBe('similar');
  });

  it('lo dichiara, e la confidenza non supera "medium"', () => {
    const result = valuate(anonimo, market([40, 55, 60, 65, 70, 90].map((price, i) => categoryMatch(price, i))));

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.confidence).not.toBe('high');
    expect(result.reasons.join(' ')).toMatch(/nessun annuncio dello stesso modello/i);
  });

  it('non ripesca i deboli quando c’e’ di meglio', () => {
    // Due buoni, perche' uno solo non fa comunque una fascia.
    const buoni: Comparable[] = [200, 220].map((price, index) => ({
      ...categoryMatch(price, 90 + index),
      matchLevel: 'exact_model' as const,
      condition: 'good' as const,
    }));
    const result = valuate(anonimo, market([...buoni, ...[10, 12].map((price, i) => categoryMatch(price, i))]));

    expect(result.available).toBe(true);
    if (!result.available) return;
    // I due deboli restano fuori: bastano gli identici, quindi la fascia
    // non li usa anche se il loro peso individuale avrebbe retto.
    expect(result.comparableTier).toBe('identical');
    expect(result.used.every((entry) => entry.comparable.matchLevel === 'exact_model')).toBe(true);
  });

  it('con condizione molto distante nemmeno un comparabile di categoria regge da solo: si ripesca', () => {
    // Qui il peso individuale (categoria + stato agli antipodi) cade sotto
    // la soglia minima: e' il caso genuino del livello "weak", diverso dal
    // caso normale sopra dove i comparabili di categoria reggevano gia' da soli.
    const estremo: Identification = { ...anonimo, condition: 'mint' };
    const deboli = [30, 35, 45, 50, 60, 65].map((price, i) =>
      categoryMatch(price, i, { condition: 'poor' }),
    );
    const result = valuate(estremo, market(deboli));

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.comparableTier).toBe('weak');
    expect(result.confidence).toBe('low');
    expect(result.reasons.join(' ')).toMatch(/stessa categoria, non dello stesso modello/);
  });

  it('quando non basta comunque, dice cosa ha visto', () => {
    // Un solo annuncio non fa una fascia, ma tacere il prezzo osservato
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
