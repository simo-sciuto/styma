import { MAX_LISTING_IMAGES } from './types';

/**
 * Leggere una pagina di Vinted, senza andarci.
 *
 * Sta separato da `vinted.ts` perche' e' l'unica parte che puo' fare danni, e
 * l'unica che si possa provare senza rete: il fetch porta dei byte, questo
 * decide quali foto appartengono all'oggetto. Una foto sbagliata qui diventa
 * un'identificazione sbagliata, che e' l'unico errore di questo prodotto che
 * non sa dichiararsi.
 */

export type JsonLdProduct = {
  '@type'?: string;
  name?: string;
  description?: string;
  image?: string | string[];
  brand?: { name?: string };
  category?: string;
  color?: string;
  offers?: { price?: number | string; priceCurrency?: string; itemCondition?: string };
};

/**
 * Dove la pagina smette di parlare di questo oggetto e comincia a
 * consigliarne altri. Misurato: delle sedici foto che la pagina porta, solo
 * cinque stanno prima di questo punto.
 */
const CONFINE_CONSIGLIATI = /Articoli simili|Potrebbero piacerti|Ti potrebbero|recommend/i;
const FOTO = /https:\/\/images\d*\.vinted\.net\/t\/[^"'\\ ]+?\/f800\/[^"'\\ ]+/g;

/**
 * Le foto dell'annuncio, separate da quelle dei consigliati.
 *
 * La foto del JSON-LD e' certa e viene per prima; le altre si prendono solo da
 * prima del confine. Se il confine non si trova si resta con la sola foto
 * certa: un'analisi su una foto e' peggiore di una su cinque, e lo dichiara da
 * sola con la confidenza bassa. Un'analisi sull'oggetto di qualcun altro no.
 */
export function extractVintedPhotos(html: string, certa: string | null): string[] {
  const trovate: string[] = [];
  if (certa) trovate.push(certa);

  const confine = html.search(CONFINE_CONSIGLIATI);
  if (confine > 0) {
    for (const match of html.matchAll(FOTO)) {
      if (match.index !== undefined && match.index >= confine) break;
      if (!trovate.includes(match[0])) trovate.push(match[0]);
    }
  }

  return trovate.slice(0, MAX_LISTING_IMAGES);
}

/** La prima foto della galleria: nella pagina completa e' quella del JSON-LD. */
export function firstVintedPhoto(html: string): string | null {
  FOTO.lastIndex = 0;
  const match = FOTO.exec(html);
  FOTO.lastIndex = 0;
  return match?.[0] ?? null;
}

/** Il titolo dai meta, senza la coda che Vinted aggiunge. */
export function titleFromOg(html: string): string | null {
  const match = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);
  const titolo = match?.[1]?.replace(/\s*\|\s*Vinted\s*$/i, '').trim();
  return titolo && titolo.length > 0 ? titolo : null;
}

/** Il JSON-LD di tipo Product, se c'e'. La pagina puo' portarne piu' d'uno. */
export function extractProduct(html: string): JsonLdProduct | null {
  for (const match of html.matchAll(
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      const parsed = JSON.parse(match[1]!) as JsonLdProduct | JsonLdProduct[];
      const candidati = Array.isArray(parsed) ? parsed : [parsed];
      const prodotto = candidati.find((voce) => voce?.['@type'] === 'Product');
      if (prodotto) return prodotto;
    } catch {
      // Un blocco illeggibile non deve impedire di guardare il successivo.
    }
  }
  return null;
}
