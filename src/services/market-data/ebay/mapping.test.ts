import { describe, expect, it } from 'vitest';

import { inferMatchLevel, isRelevantTitle, mentionsObjectType, toComparable } from './mapping';

const item = (overrides: Record<string, unknown> = {}) => ({
  title: 'Canon AE-1 fotocamera 35mm con obiettivo 50mm',
  itemWebUrl: 'https://www.ebay.it/itm/123456',
  price: { value: '149.90', currency: 'EUR' },
  condition: 'Usato',
  conditionId: '3000',
  ...overrides,
});

const QUERY = 'Canon AE-1';

/** Il contesto della fotocamera usata in quasi tutti i casi qui sotto. */
const canon = (overrides: Partial<Parameters<typeof toComparable>[1]> = {}) => ({
  brand: 'Canon' as string | null,
  model: 'AE-1' as string | null,
  objectType: 'reflex 35mm' as string | null,
  query: QUERY,
  ...overrides,
});

describe('somiglianza dedotta dal titolo', () => {
  it('marca e modello presenti: stesso modello', () => {
    expect(inferMatchLevel('Canon AE-1 body nero', 'Canon', 'AE-1')).toBe('exact_model');
  });

  it('solo la marca: stessa marca', () => {
    expect(inferMatchLevel('Canon A-1 reflex', 'Canon', 'AE-1')).toBe('same_brand');
  });

  it('ne’ marca ne’ modello: categoria e basta', () => {
    expect(inferMatchLevel('Reflex analogica vintage', 'Canon', 'AE-1')).toBe('similar_category');
  });

  it('non si fa ingannare da maiuscole e punteggiatura', () => {
    expect(inferMatchLevel('CANON  ae1 PROGRAM', 'canon', 'AE 1')).toBe('exact_model');
  });

  it('senza marca ne’ modello noti resta prudente', () => {
    expect(inferMatchLevel('Qualcosa di vintage', null, null)).toBe('similar_category');
  });
});

describe('pertinenza del titolo rispetto alla query', () => {
  it('accetta un titolo che condivide una parola vera con la query', () => {
    expect(isRelevantTitle('Pochette da sera con perline bianche anni 2000', 'pochette perline bianche vintage')).toBe(
      true,
    );
  });

  it('rifiuta un titolo senza nessuna parola in comune: il caso vero, borsa cercata e trolley trovato', () => {
    expect(isRelevantTitle('Trolley da viaggio rigido 4 ruote nero', 'pochette perline bianche vintage')).toBe(
      false,
    );
  });

  it('ignora le parole troppo generiche per contare come prova', () => {
    // "vintage" e "anni" compaiono ovunque, pertinente o no: da sole non bastano.
    expect(isRelevantTitle('Trolley vintage anni 90', 'borsa vintage anni 2000')).toBe(false);
  });

  it('senza parole utili nella query non rifiuta alla cieca', () => {
    expect(isRelevantTitle('Qualsiasi cosa', 'con per')).toBe(true);
  });
});

describe('da inserzione eBay a comparabile', () => {
  it('legge prezzo, valuta, stato e URL', () => {
    const comparable = toComparable(item(), canon());

    expect(comparable).toMatchObject({
      source: 'eBay',
      price: 149.9,
      currency: 'EUR',
      condition: 'good',
      matchLevel: 'exact_model',
      url: 'https://www.ebay.it/itm/123456',
    });
  });

  it('e’ sempre un prezzo richiesto, mai una vendita', () => {
    // La Browse API restituisce inserzioni attive. Chiamarle "sold" perche'
    // vengono da eBay sarebbe la bugia piu' facile da fare qui.
    expect(toComparable(item(), canon())?.kind).toBe('asking');
    expect(toComparable(item(), canon())?.soldAt).toBeNull();
  });

  it('scarta un’inserzione senza prezzo utilizzabile', () => {
    expect(toComparable(item({ price: { value: '0', currency: 'EUR' } }), canon())).toBeNull();
    expect(toComparable(item({ price: { value: 'n/d', currency: 'EUR' } }), canon())).toBeNull();
  });

  it('scarta una valuta che non sappiamo convertire', () => {
    expect(toComparable(item({ price: { value: '100', currency: 'JPY' } }), canon())).toBeNull();
  });

  it('scarta un oggetto che non ha la forma attesa', () => {
    expect(toComparable({ titolo: 'sbagliato' }, canon())).toBeNull();
    expect(toComparable(null, canon())).toBeNull();
  });

  it('traduce gli stati eBay, e "per ricambi" resta il peggiore', () => {
    expect(toComparable(item({ conditionId: '1000' }), canon())?.condition).toBe('mint');
    expect(toComparable(item({ conditionId: '2000' }), canon())?.condition).toBe('excellent');
    expect(toComparable(item({ conditionId: '7000' }), canon())?.condition).toBe('poor');
    expect(toComparable(item({ conditionId: undefined }), canon())?.condition).toBe('unknown');
  });

  it('scarta un’inserzione fuori tema quando non c’e’ marca ne’ modello a garantire', () => {
    // Il caso vero: senza marca ne' modello, "similar_category" era l'unico
    // livello possibile qualunque cosa eBay avesse restituito.
    const trolley = item({ title: 'Trolley da viaggio rigido 4 ruote nero' });
    expect(toComparable(trolley, { brand: null, model: null, objectType: 'pochette', query: 'pochette perline bianche vintage' })).toBeNull();
  });

  it('scarta un altro tipo di oggetto della stessa marca: il caso vero della polo', () => {
    // Segnalato dal vivo: fotografata una polo Fred Perry, senza cartellino
    // leggibile il modello e' null e la marca e' l'unica prova che eBay puo'
    // confermare. Maglioni e cappotti della stessa marca entravano nella
    // stima con lo stesso peso di un'altra polo, e costano tutt'altro.
    const context = {
      brand: 'Fred Perry',
      model: null,
      objectType: 'polo',
      query: 'Fred Perry polo',
    };

    const maglione = item({ title: 'Fred Perry maglione lana scollo a V blu M' });
    expect(toComparable(maglione, context)).toBeNull();

    const cappotto = item({ title: 'Fred Perry cappotto harrington nero taglia L' });
    expect(toComparable(cappotto, context)).toBeNull();

    const polo = item({ title: 'Polo Fred Perry M3600 bianca bordi neri taglia M' });
    expect(toComparable(polo, context)?.matchLevel).toBe('same_brand');
  });

  it('non scarta un tipo vicino: lampada da terra contro lampada da tavolo', () => {
    // Una parola in comune basta. Un lampadario della stessa marca resta un
    // comparabile ragionevole; un maglione contro una polo no.
    const context = {
      brand: 'Artemide',
      model: null,
      objectType: 'lampada da tavolo',
      query: 'Artemide lampada da tavolo',
    };

    const daTerra = item({ title: 'Artemide lampada da terra Tolomeo Mega' });
    expect(toComparable(daTerra, context)).not.toBeNull();
  });

  it('senza un tipo utilizzabile non rifiuta alla cieca', () => {
    // "oggetto" non dice che tipo di oggetto sia: pretenderlo nel titolo
    // scarterebbe tutto invece di scartare cio' che c'entra poco.
    expect(mentionsObjectType('Fred Perry maglione lana', 'oggetto')).toBe(true);
    expect(mentionsObjectType('Fred Perry maglione lana', null)).toBe(true);
  });

  it('non scarta un’inserzione fuori tema se marca o modello la confermano comunque', () => {
    // Qui il titolo non c'entra con la query, ma marca e modello sono gia'
    // una prova migliore del testo libero: il filtro non deve toglierla.
    const comparable = toComparable(item(), canon({ query: 'tutt’altra cosa' }));
    expect(comparable).not.toBeNull();
  });
});
