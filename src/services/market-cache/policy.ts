import type { Identification, MarketPace } from '@/schemas/identification';
import type { MarketResearch } from '@/schemas/market';

/**
 * Per quanti giorni una ricerca di mercato resta riutilizzabile, secondo il
 * ritmo della categoria.
 *
 * L'elettronica non si deprezza in modo graduale: si deprezza a gradini,
 * quando esce il modello nuovo. Sette giorni e non quattordici perche' un
 * gradino preso in ritardo non e' un'imprecisione, e' un prezzo che non
 * esiste piu'. Sbagliare per eccesso di prudenza costa qualche centesimo di
 * ricerca; sbagliare per eccesso di fiducia manda a comprare male.
 */
export const CACHE_TTL_DAYS: Record<MarketPace, number> = {
  /** Modernariato, design, arte, mobili, libri, dischi, strumenti. */
  slow: 30,
  /** Abbigliamento, orologi, ceramiche, giocattoli da collezione, biciclette. */
  medium: 14,
  /** Elettronica, telefoni, computer, console, fotocamere digitali, elettrodomestici. */
  fast: 7,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Confidenza minima sull'identificazione per poter scrivere in cache.
 * Sotto questa soglia l'oggetto non e' riconosciuto abbastanza bene da
 * garantire che la chiave descriva davvero cio' che si e' cercato: una
 * ricerca archiviata sulla chiave sbagliata contamina tutti quelli dopo.
 */
export const MIN_CONFIDENCE_TO_CACHE = 0.75;

/**
 * Il modello scrive il modello come gli viene: la stessa macchina e' uscita una
 * volta come "AE-1" e una come "AE-1 con FD 50mm f/1.8". Due chiavi diverse
 * significano cache mancata e ricerca ripagata, che e' il modo piu' silenzioso
 * di non funzionare. Si tiene solo cio' che precede un accessorio o una
 * precisazione.
 */
const ACCESSORY_SEPARATORS = /\s+(?:con|with|avec|mit|piu'|più|\+|e)\s+|[,(\/]/i;

function coreModel(model: string): string {
  return model.split(ACCESSORY_SEPARATORS)[0] ?? model;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Chiave della cache: marca e modello, nient'altro.
 *
 * Non entrano ne' lo stato di conservazione ne' il prezzo: i comparabili
 * descrivono il modello, e la valutazione applica lo stato dell'esemplare
 * per conto suo. Entra solo cio' che identifica *quale* oggetto e'.
 *
 * `null` quando marca o modello mancano: senza i due l'unica alternativa
 * sarebbe il nome libero, che cambia a ogni foto e finirebbe per servire i
 * comparabili di un oggetto a un altro.
 */
export function cacheKey(identification: Identification): string | null {
  const brand = normalize(identification.brand ?? '');
  const model = normalize(coreModel(identification.model ?? ''));
  if (brand === '' || model === '') return null;
  return `${brand}|${model}`;
}

export type CacheDecision = { cacheable: true; key: string } | { cacheable: false; reason: string };

/** Se questa analisi puo' leggere e scrivere in cache, e perche' no. */
export function decideCacheability(identification: Identification): CacheDecision {
  const key = cacheKey(identification);
  if (key === null) {
    return { cacheable: false, reason: 'marca o modello non identificati' };
  }
  if (identification.confidence < MIN_CONFIDENCE_TO_CACHE) {
    return { cacheable: false, reason: 'identificazione troppo incerta' };
  }
  return { cacheable: true, key };
}

/**
 * Una ricerca senza comparabili non si archivia. Potrebbe voler dire che
 * l'oggetto non ha mercato, ma molto piu' spesso vuol dire che quella
 * ricerca e' andata male: archiviarla condannerebbe tutti a ripetere lo
 * stesso buco fino alla scadenza.
 */
export function worthStoring(research: MarketResearch): boolean {
  return research.comparables.length > 0;
}

export function ttlDaysFor(pace: MarketPace): number {
  return CACHE_TTL_DAYS[pace];
}

export function expiryFor(pace: MarketPace, from: Date = new Date()): Date {
  return new Date(from.getTime() + ttlDaysFor(pace) * DAY_MS);
}

/** Giorni interi trascorsi da una ricerca, per poterlo dire a chi legge. */
export function ageInDays(researchedAt: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - researchedAt.getTime()) / DAY_MS);
}
