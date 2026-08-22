import { describe, expect, it } from 'vitest';

import type { Comparable, MarketResearch } from '@/schemas/market';
import { comparableKey, mergeMarketResearch } from './merge';

function comparable(overrides: Partial<Comparable> = {}): Comparable {
  return {
    title: 'Olivetti Valentine',
    source: 'eBay',
    url: 'https://www.ebay.it/itm/123456',
    price: 400,
    currency: 'EUR',
    kind: 'asking',
    soldAt: null,
    condition: 'good',
    matchLevel: 'exact_model',
    notes: '',
    ...overrides,
  };
}

function lane(overrides: Partial<MarketResearch> = {}): MarketResearch {
  return { comparables: [], demand: 'unknown', liquidity: 'unknown', notes: [], ...overrides };
}

describe('comparableKey', () => {
  it('ignora www, schema, slash finale e parametri di tracciamento', () => {
    const a = comparableKey('https://www.ebay.it/itm/123456/?utm_source=x&mkevt=1&_trksid=abc');
    const b = comparableKey('http://ebay.it/itm/123456');
    expect(a).toBe(b);
  });

  it('non confonde annunci distinti che si distinguono per un parametro', () => {
    expect(comparableKey('https://shop.it/listing?id=1')).not.toBe(
      comparableKey('https://shop.it/listing?id=2'),
    );
  });

  it('e’ indifferente all’ordine dei parametri', () => {
    expect(comparableKey('https://shop.it/l?b=2&a=1')).toBe(comparableKey('https://shop.it/l?a=1&b=2'));
  });

  it('non esplode su un URL malformato', () => {
    expect(comparableKey('non-un-url/')).toBe('non-un-url');
  });
});

describe('mergeMarketResearch', () => {
  it('conta una volta sola la stessa pagina trovata da due corsie', () => {
    const merged = mergeMarketResearch([
      lane({ comparables: [comparable()] }),
      lane({ comparables: [comparable({ url: 'https://ebay.it/itm/123456?utm_source=google' })] }),
    ]);

    expect(merged.comparables).toHaveLength(1);
  });

  it('fra due letture della stessa pagina tiene quella che dice di piu’', () => {
    const merged = mergeMarketResearch([
      lane({ comparables: [comparable({ kind: 'asking', soldAt: null })] }),
      lane({
        comparables: [
          comparable({ url: 'https://ebay.it/itm/123456/', kind: 'sold', soldAt: '2026-05-04' }),
        ],
      }),
    ]);

    expect(merged.comparables).toHaveLength(1);
    expect(merged.comparables[0]).toMatchObject({ kind: 'sold', soldAt: '2026-05-04' });
  });

  it('somma i comparabili di corsie che hanno trovato pagine diverse', () => {
    const merged = mergeMarketResearch([
      lane({ comparables: [comparable({ url: 'https://ebay.it/itm/1' })] }),
      lane({ comparables: [comparable({ url: 'https://catawiki.com/l/2' })] }),
      lane({ comparables: [comparable({ url: 'https://subito.it/x/3' })] }),
    ]);

    expect(merged.comparables).toHaveLength(3);
  });

  it('ignora le corsie che dichiarano di non sapere', () => {
    const merged = mergeMarketResearch([
      lane({ demand: 'high', liquidity: 'fast' }),
      lane({ demand: 'unknown', liquidity: 'unknown' }),
      lane({ demand: 'unknown', liquidity: 'unknown' }),
    ]);

    expect(merged.demand).toBe('high');
    expect(merged.liquidity).toBe('fast');
  });

  it('segue la maggioranza sulla domanda', () => {
    const merged = mergeMarketResearch([
      lane({ demand: 'high' }),
      lane({ demand: 'medium' }),
      lane({ demand: 'medium' }),
    ]);

    expect(merged.demand).toBe('medium');
  });

  it('a parita’ di voti sceglie la lettura piu’ prudente', () => {
    const demand = mergeMarketResearch([lane({ demand: 'high' }), lane({ demand: 'low' })]).demand;
    const liquidity = mergeMarketResearch([
      lane({ liquidity: 'fast' }),
      lane({ liquidity: 'slow' }),
    ]).liquidity;

    expect(demand).toBe('low');
    expect(liquidity).toBe('slow');
  });

  it('resta unknown se nessuna corsia si sbilancia', () => {
    const merged = mergeMarketResearch([lane(), lane()]);
    expect(merged.demand).toBe('unknown');
    expect(merged.liquidity).toBe('unknown');
  });

  it('non ripete la stessa nota due volte', () => {
    const merged = mergeMarketResearch([
      lane({ notes: ['La plastica rossa ingiallisce.', ''] }),
      lane({ notes: ['  la plastica rossa ingiallisce.  ', 'Le varianti blu valgono di piu’.'] }),
    ]);

    expect(merged.notes).toEqual(['La plastica rossa ingiallisce.', 'Le varianti blu valgono di piu’.']);
  });

  it('regge il caso in cui tutte le corsie tornano vuote', () => {
    const merged = mergeMarketResearch([lane(), lane(), lane()]);
    expect(merged.comparables).toEqual([]);
    expect(merged.notes).toEqual([]);
  });
});
