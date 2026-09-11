import 'server-only';

import { ListingError, MAX_LISTING_IMAGES, type SharedListing } from './types';

/**
 * Un annuncio Vinted, letto dalla sua pagina.
 *
 * Lo facciamo perche' Vinted dice che si puo': il loro `robots.txt` lascia
 * `/items/` aperto a `User-Agent: *` e porta `Content-Signal: ai-train=no,
 * search=yes, ai-input=yes`, dove «ai-input» e' definito nel file stesso come
 * dare contenuto in pasto a un modello. Una pagina per volta, su richiesta di
 * chi la sta guardando, senza addestrare niente. Se quel segnale diventa `no`,
 * questa funzione si spegne.
 *
 * Tutto quello che serve sta nel JSON-LD che la pagina pubblica per i motori
 * di ricerca: nome, descrizione, foto, marca, prezzo, categoria, stato. E'
 * dato strutturato e dichiarato, non testo strappato dall'HTML, ed e' l'unico
 * pezzo della pagina su cui si possa contare da una settimana all'altra.
 */

/** La pagina pesa due megabyte: oltre, qualcosa non e' andato come pensiamo. */
const MAX_BYTES = 6_000_000;
const TIMEOUT_MS = 12_000;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

type JsonLdProduct = {
  '@type'?: string;
  name?: string;
  description?: string;
  image?: string | string[];
  brand?: { name?: string };
  category?: string;
  color?: string;
  offers?: { price?: number | string; priceCurrency?: string; itemCondition?: string };
};

/** Da `UsedCondition` / `NewCondition` alle parole che usa chi vende. */
const STATI: Record<string, string> = {
  NewCondition: 'nuovo',
  UsedCondition: 'usato',
  RefurbishedCondition: 'ricondizionato',
  DamagedCondition: 'danneggiato',
};

function leggiStato(raw: string | undefined): string | null {
  if (!raw) return null;
  const nome = raw.split('/').pop() ?? raw;
  return STATI[nome] ?? null;
}

/**
 * Le foto dell'annuncio, separate da quelle dei consigliati.
 *
 * La pagina ne porta sedici, e solo cinque sono dell'oggetto: le altre
 * appartengono agli articoli suggeriti in fondo. Un comparabile sbagliato
 * costa una stima storta; una *foto* sbagliata costa un'identificazione
 * sbagliata, che e' l'unico errore di questo prodotto che non sa dichiararsi.
 *
 * Quindi: la foto del JSON-LD e' certa e viene per prima, e le altre si
 * prendono solo da prima del punto in cui la pagina comincia a consigliare.
 * Se quel punto non si trova, si resta con la sola foto certa: un'analisi su
 * una foto e' peggiore di una su cinque, e lo dichiara da sola con la
 * confidenza bassa. Un'analisi sulla borsa di qualcun altro no.
 */
const CONFINE_CONSIGLIATI = /Articoli simili|Potrebbero piacerti|Ti potrebbero|recommend/i;
const FOTO = /https:\/\/images\d*\.vinted\.net\/t\/[^"'\\ ]+?\/f800\/[^"'\\ ]+/g;

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

export async function fetchVintedListing(url: string): Promise<SharedListing> {
  let html: string;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'it-IT,it;q=0.9' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });

    if (response.status === 404 || response.status === 410) {
      throw new ListingError('Questo annuncio non esiste piu’ su Vinted.', 'not_found');
    }
    if (!response.ok) {
      throw new ListingError('Vinted non ci ha fatto leggere questo annuncio.', 'unreachable');
    }

    html = await response.text();
    if (html.length > MAX_BYTES) html = html.slice(0, MAX_BYTES);
  } catch (caught) {
    if (caught instanceof ListingError) throw caught;
    console.error('[listings] lettura Vinted fallita', caught);
    throw new ListingError('Vinted non risponde. Riprova fra poco.', 'unreachable');
  }

  const prodotto = extractProduct(html);
  if (!prodotto?.name) {
    // La pagina c'e' ma non e' quella che ci aspettavamo: meglio dirlo che
    // analizzare qualcosa di raccolto a caso.
    throw new ListingError('Questa pagina di Vinted non sembra un annuncio.', 'unreadable');
  }

  const certa = typeof prodotto.image === 'string' ? prodotto.image : (prodotto.image?.[0] ?? null);
  const imageUrls = extractVintedPhotos(html, certa);
  if (imageUrls.length === 0) {
    throw new ListingError('Questo annuncio non ha foto da guardare.', 'no_photos');
  }

  const prezzo = Number(prodotto.offers?.price);
  const inEuro = prodotto.offers?.priceCurrency === 'EUR' && Number.isFinite(prezzo) && prezzo > 0;

  return {
    source: 'vinted',
    url,
    title: prodotto.name,
    priceEur: inEuro ? prezzo : null,
    brand: prodotto.brand?.name ?? null,
    category: prodotto.category ?? null,
    condition: leggiStato(prodotto.offers?.itemCondition),
    // Tagliata: serve a chi legge per riconoscere l'annuncio, non a noi per
    // dedurre qualcosa. Le deduzioni si fanno sulle foto.
    description: prodotto.description ? prodotto.description.slice(0, 400) : null,
    imageUrls,
  };
}
