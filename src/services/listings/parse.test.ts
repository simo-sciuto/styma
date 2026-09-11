import { describe, expect, it } from 'vitest';

import { parseListingUrl, sellerQuery } from './parse';

describe('riconoscere il link di un annuncio', () => {
  it('legge un link Vinted con lo slug', () => {
    const parsed = parseListingUrl(
      'https://www.vinted.it/items/9961066353-borsetta-a-tracolla-the-north-face-base-camp-high-pile-mini',
    );
    expect(parsed).toEqual({
      source: 'vinted',
      id: '9961066353',
      url: 'https://www.vinted.it/items/9961066353-borsetta-a-tracolla-the-north-face-base-camp-high-pile-mini',
    });
  });

  it('vale su qualunque dominio nazionale di Vinted', () => {
    expect(parseListingUrl('https://www.vinted.fr/items/123456')?.source).toBe('vinted');
    expect(parseListingUrl('https://www.vinted.co.uk/items/123456')?.source).toBe('vinted');
    expect(parseListingUrl('https://vinted.de/items/123456')?.id).toBe('123456');
  });

  it('legge un link eBay, con o senza slug', () => {
    expect(parseListingUrl('https://www.ebay.it/itm/335678901234')?.id).toBe('335678901234');
    expect(parseListingUrl('https://www.ebay.it/itm/olivetti-valentine/335678901234')?.id).toBe(
      '335678901234',
    );
  });

  it('butta via il tracciamento', () => {
    // Due link allo stesso annuncio devono essere lo stesso annuncio, e un
    // link condiviso da un telefono arriva sempre pieno di parametri.
    const parsed = parseListingUrl(
      'https://www.vinted.it/items/9961066353-borsetta?utm_source=share&referrer=abc#foto',
    );
    expect(parsed?.url).toBe('https://www.vinted.it/items/9961066353-borsetta');
  });

  it('perdona lo schema mancante, che nessuno copia', () => {
    expect(parseListingUrl('vinted.it/items/9961066353-borsetta')?.id).toBe('9961066353');
    expect(parseListingUrl('  www.vinted.it/items/9961066353  ')?.id).toBe('9961066353');
  });

  it('dice di no a quello che non sappiamo leggere', () => {
    expect(parseListingUrl('https://www.subito.it/elettronica/annuncio-123.htm')).toBeNull();
    expect(parseListingUrl('https://www.wallapop.com/item/123')).toBeNull();
    expect(parseListingUrl('https://www.facebook.com/marketplace/item/123')).toBeNull();
  });

  it('dice di no a un link della piattaforma giusta che non e’ un annuncio', () => {
    // La home, una ricerca, un profilo: hanno il dominio buono e non c'e'
    // niente da valutare.
    expect(parseListingUrl('https://www.vinted.it/')).toBeNull();
    expect(parseListingUrl('https://www.vinted.it/catalog?search_text=olivetti')).toBeNull();
    expect(parseListingUrl('https://www.ebay.it/sch/i.html?_nkw=olivetti')).toBeNull();
  });

  it('non si fa ingannare da un dominio che ci somiglia', () => {
    expect(parseListingUrl('https://vinted.it.truffa.example/items/123456')).toBeNull();
    expect(parseListingUrl('https://notvinted.it/items/123456')).toBeNull();
  });

  it('non esplode su spazzatura', () => {
    expect(parseListingUrl('')).toBeNull();
    expect(parseListingUrl('   ')).toBeNull();
    expect(parseListingUrl('ciao come stai')).toBeNull();
    expect(parseListingUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('il titolo del venditore come query', () => {
  it('taglia le parole prima della marca', () => {
    // Misurato: il titolo intero da' zero risultati su cinque mercati, questo
    // taglio ne da' tre e centrati. Le parole prima della marca sono come il
    // venditore chiama la categoria nella sua lingua, e nei titoli eBay non
    // ci sono.
    expect(
      sellerQuery('Borsetta a tracolla The North Face Base Camp High Pile Mini', 'The North Face'),
    ).toBe('The North Face Base Camp High Pile Mini');
  });

  it('lascia in pace un titolo che comincia gia’ dalla marca', () => {
    expect(sellerQuery('Olivetti Valentine rossa', 'Olivetti')).toBe('Olivetti Valentine rossa');
  });

  it('accorcia comunque: una query lunga su eBay cerca la frase, non l’oggetto', () => {
    const lungo = 'Nikon FM2 corpo macchina reflex analogica 35mm perfettamente funzionante revisionata';
    expect(sellerQuery(lungo, 'Nikon')?.split(' ')).toHaveLength(8);
  });

  it('senza marca taglia e basta', () => {
    expect(sellerQuery('Vaso in ceramica smaltata blu anni settanta fatto a mano', null)).toBe(
      'Vaso in ceramica smaltata blu anni settanta fatto',
    );
  });

  it('non si perde con una marca che comincia per articolo', () => {
    // «The» da solo si trova ovunque: la marca va cercata come frase intera,
    // o il taglio finisce nel punto sbagliato.
    expect(sellerQuery('The best borsa The North Face Base Camp', 'The North Face')).toBe(
      'The North Face Base Camp',
    );
  });

  it('non fa una query da un titolo che non c’e’', () => {
    expect(sellerQuery('', 'Nikon')).toBeNull();
    expect(sellerQuery('  ', null)).toBeNull();
  });
});
