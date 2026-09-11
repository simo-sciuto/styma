import 'server-only';

import { ListingError, type SharedListing } from './types';
import {
  extractProduct,
  extractVintedPhotos,
  firstVintedPhoto,
  titleFromOg,
} from './vinted-parse';

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
  if (prodotto?.name) {
    const certa =
      typeof prodotto.image === 'string' ? prodotto.image : (prodotto.image?.[0] ?? null);
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

  return leggiPaginaSpoglia(html, url);
}

/**
 * La stessa pagina, quando Vinted non serve il JSON-LD.
 *
 * Succede: la pagina risponde 200, il titolo e le foto ci sono, e il blocco
 * di dati strutturati semplicemente non c'e'. Misurato sullo stesso annuncio a
 * un'ora di distanza, prima con e poi senza.
 *
 * Quello che si perde non e' solo il prezzo. **Si perde il confine fra le foto
 * dell'oggetto e quelle dei consigliati**: nella versione completa cinque foto
 * su sedici stanno prima del marcatore, in questa quindici su sedici, cioe' il
 * marcatore non separa piu' niente. Prendere le prime cinque vorrebbe dire
 * identificare la borsa di qualcun altro, che e' l'unico errore di questo
 * prodotto che non sa dichiararsi.
 *
 * Quindi una foto sola: la prima della galleria, che nella versione completa
 * e' esattamente quella del JSON-LD. Un'identificazione su una foto e' piu'
 * debole e lo dichiara da sola, con la confidenza e con «una foto in piu'
 * aiuterebbe». Un'identificazione sull'oggetto sbagliato no.
 */
function leggiPaginaSpoglia(html: string, url: string): SharedListing {
  const titolo = titleFromOg(html);
  if (!titolo) {
    throw new ListingError('Questa pagina di Vinted non sembra un annuncio.', 'unreadable');
  }

  const prima = firstVintedPhoto(html);
  if (!prima) {
    throw new ListingError('Questo annuncio non ha foto da guardare.', 'no_photos');
  }

  return {
    source: 'vinted',
    url,
    title: titolo,
    // Il prezzo non c'e' e non si indovina: lo scrive chi guarda.
    priceEur: null,
    brand: null,
    category: null,
    condition: null,
    description: null,
    imageUrls: [prima],
  };
}
