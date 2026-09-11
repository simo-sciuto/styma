import { describe, expect, it } from 'vitest';

import { extractProduct, extractVintedPhotos } from './vinted-parse';

/**
 * HTML scritto qui, non una pagina vera salvata su disco.
 *
 * Una pagina di Vinted pesa due megabyte e appartiene a loro: tenerne una
 * copia nel repository sarebbe archiviare contenuto altrui per comodita'
 * nostra, che e' un'altra cosa rispetto a leggerla una volta su richiesta di
 * chi la sta guardando. Questi frammenti riproducono le due forme che abbiamo
 * misurato, e bastano a coprire la logica che puo' fare danni.
 */
const foto = (id: string) =>
  `https://images1.vinted.net/t/${id}/f800/abc123.webp?s=deadbeef`;

describe('le foto dell’annuncio, separate dai consigliati', () => {
  it('tiene solo quelle prima del confine', () => {
    // E' la regola che evita di identificare la borsa di qualcun altro: le
    // foto dopo «Articoli simili» appartengono ad altri annunci.
    const html = `
      <img src="${foto('01_mia')}">
      <img src="${foto('02_mia')}">
      <h2>Articoli simili</h2>
      <img src="${foto('03_altrui')}">
      <img src="${foto('04_altrui')}">
    `;
    expect(extractVintedPhotos(html, null)).toEqual([foto('01_mia'), foto('02_mia')]);
  });

  it('mette per prima quella certa del JSON-LD, senza ripeterla', () => {
    const html = `
      <img src="${foto('01_mia')}">
      <img src="${foto('02_mia')}">
      <h2>Potrebbero piacerti</h2>
      <img src="${foto('99_altrui')}">
    `;
    expect(extractVintedPhotos(html, foto('01_mia'))).toEqual([foto('01_mia'), foto('02_mia')]);
  });

  it('senza confine si ferma alla foto certa', () => {
    // Se il marcatore non c'e', non sappiamo dove finiscono le nostre foto.
    // Una in meno e' un'analisi piu' debole, che si dichiara da sola; una di
    // troppo e' un oggetto sbagliato, che non si dichiara affatto.
    const html = `<img src="${foto('01_mia')}"><img src="${foto('02_boh')}">`;
    expect(extractVintedPhotos(html, foto('01_mia'))).toEqual([foto('01_mia')]);
    expect(extractVintedPhotos(html, null)).toEqual([]);
  });

  it('non ne prende piu’ di cinque', () => {
    const molte = Array.from({ length: 9 }, (_, i) => `<img src="${foto(`0${i}_mia`)}">`).join('');
    const html = `${molte}<h2>Articoli simili</h2>`;
    expect(extractVintedPhotos(html, null)).toHaveLength(5);
  });
});

describe('il blocco di dati strutturati', () => {
  it('legge il prodotto', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Product',
      name: 'Olivetti Valentine',
      offers: { price: 140, priceCurrency: 'EUR' },
    })}</script>`;
    expect(extractProduct(html)?.name).toBe('Olivetti Valentine');
  });

  it('lo trova anche dentro un elenco, o dopo un blocco rotto', () => {
    const html = `
      <script type="application/ld+json">{ questo non e' JSON }</script>
      <script type="application/ld+json">${JSON.stringify([
        { '@type': 'BreadcrumbList' },
        { '@type': 'Product', name: 'Vaso' },
      ])}</script>
    `;
    expect(extractProduct(html)?.name).toBe('Vaso');
  });

  it('dice di no quando non c’e’, invece di indovinare', () => {
    expect(extractProduct('<html><body>niente</body></html>')).toBeNull();
    expect(
      extractProduct(`<script type="application/ld+json">${JSON.stringify({ '@type': 'WebSite' })}</script>`),
    ).toBeNull();
  });
});
