import type { ListingSource } from './parse';

/**
 * Un annuncio letto da un link, ridotto a cio' che serve.
 *
 * Ogni campo qui dentro e' **quello che dice chi vende**, non quello che
 * sappiamo noi. Il titolo, la marca, lo stato: sono dichiarazioni. Il prodotto
 * le tiene separate dalla propria identificazione apposta — se il venditore
 * scrive «Olivetti Valentine» e le foto mostrano una Lettera 32, quel
 * disaccordo e' l'informazione piu' utile della pagina, e sparirebbe se
 * mescolassimo le due cose in un campo solo.
 *
 * Per questo l'identificazione gira sulle foto e basta, come sempre: il testo
 * dell'annuncio non entra nel prompt. Un venditore che sbaglia nome non deve
 * poterci far sbagliare stima.
 */
export type SharedListing = {
  source: ListingSource;
  url: string;
  /** Il titolo scritto dal venditore. */
  title: string;
  /** Quanto chiede, in euro. Null quando la pagina non lo dichiara. */
  priceEur: number | null;
  /** La marca dichiarata, se la piattaforma la struttura. */
  brand: string | null;
  /** La categoria dichiarata, come la scrive la piattaforma. */
  category: string | null;
  /** Lo stato dichiarato, nelle parole della piattaforma. */
  condition: string | null;
  /** Quanto ha detto il venditore, tagliato: serve a chi legge, non al modello. */
  description: string | null;
  /** Le foto dell'annuncio, gia' ridotte a quelle che useremo. */
  imageUrls: string[];
};

/** Quante foto prendere da un annuncio. Oltre, si paga attenzione senza guadagnarci. */
export const MAX_LISTING_IMAGES = 5;

/**
 * Un annuncio che non si e' potuto leggere, con il motivo giusto.
 *
 * I casi sono diversi e vanno detti diversi: un link sbagliato, un annuncio
 * sparito, una piattaforma che non risponde. «Non ha funzionato» manda a
 * cercare un guasto che magari non c'e'.
 */
export class ListingError extends Error {
  constructor(
    message: string,
    readonly code: 'unsupported' | 'not_found' | 'unreachable' | 'unreadable' | 'no_photos',
  ) {
    super(message);
    this.name = 'ListingError';
  }
}
