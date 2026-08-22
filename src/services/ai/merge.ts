import type { Comparable, MarketResearch } from '@/schemas/market';

/**
 * Parametri che identificano la provenienza del click, non l'oggetto: due URL
 * che differiscono solo per questi puntano alla stessa pagina.
 */
const TRACKING_PARAMS =
  /^(utm_|_trk|_from|_trksid|gclid|fbclid|msclkid|ref$|referrer|epid|mkevt|mkcid|mkrid|campid|toolid|customid|amdata|hash|si$|source$)/i;

/**
 * Chiave di identita' di un annuncio. I parametri di query vanno tenuti (su
 * certi siti l'id dell'oggetto sta li'), tolti quelli di tracciamento e
 * ordinati i rimanenti, altrimenti lo stesso annuncio arrivato da due corsie
 * diverse sembra due annunci.
 */
export function comparableKey(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '');
    const params = [...url.searchParams.entries()]
      .filter(([name]) => !TRACKING_PARAMS.test(name))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${name}=${value}`)
      .join('&');
    return params ? `${host}${path}?${params}` : `${host}${path}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

const MATCH_RANK: Record<Comparable['matchLevel'], number> = {
  exact_model: 3,
  same_family: 2,
  same_brand: 1,
  similar_category: 0,
};

/**
 * Fra due versioni della stessa pagina si tiene quella che dice di piu':
 * una vendita conclusa batte un prezzo richiesto, una data batte l'assenza
 * di data. Non si mediano: sono la stessa pagina letta due volte, non due dati.
 */
function informationScore(comparable: Comparable): number {
  return (
    (comparable.kind === 'sold' ? 8 : 0) +
    (comparable.soldAt ? 4 : 0) +
    MATCH_RANK[comparable.matchLevel] * 0.1 +
    (comparable.condition === 'unknown' ? 0 : 2)
  );
}

/** Domanda e liquidita' dalla piu' prudente alla piu' ottimista. */
const DEMAND_ORDER = ['low', 'medium', 'high'] as const;
const LIQUIDITY_ORDER = ['slow', 'average', 'fast'] as const;

/**
 * Ogni corsia vota su cio' che ha visto nel proprio pezzo di mercato. Vince
 * la maggioranza; a parita' si sceglie il valore piu' prudente, perche' una
 * domanda sopravvalutata alza il flip score e manda a comprare.
 */
function vote<T extends string>(values: T[], order: readonly T[]): T | 'unknown' {
  const counts = new Map<T, number>();
  for (const value of values) {
    if (!order.includes(value)) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  if (counts.size === 0) return 'unknown';

  let winner: T | null = null;
  let best = -1;
  for (const candidate of order) {
    const count = counts.get(candidate) ?? 0;
    // `>` e non `>=`: scorrendo dal prudente all'ottimista, a parita' resta il primo.
    if (count > best) {
      best = count;
      winner = candidate;
    }
  }
  return winner ?? 'unknown';
}

const MAX_NOTES = 8;

/**
 * Unisce i risultati delle corsie di ricerca in un'unica lettura di mercato.
 * Funzione pura: e' la parte del parallelismo che si puo' verificare senza
 * chiamare il modello, ed e' anche quella che sbaglierebbe in silenzio.
 */
export function mergeMarketResearch(parts: MarketResearch[]): MarketResearch {
  const byKey = new Map<string, Comparable>();

  for (const part of parts) {
    for (const comparable of part.comparables) {
      const key = comparableKey(comparable.url);
      const existing = byKey.get(key);
      if (!existing || informationScore(comparable) > informationScore(existing)) {
        byKey.set(key, comparable);
      }
    }
  }

  const seenNotes = new Set<string>();
  const notes: string[] = [];
  for (const part of parts) {
    for (const note of part.notes) {
      const fingerprint = note.trim().toLowerCase();
      if (fingerprint === '' || seenNotes.has(fingerprint)) continue;
      seenNotes.add(fingerprint);
      notes.push(note.trim());
    }
  }

  return {
    comparables: [...byKey.values()],
    demand: vote(
      parts.map((part) => part.demand),
      DEMAND_ORDER,
    ),
    liquidity: vote(
      parts.map((part) => part.liquidity),
      LIQUIDITY_ORDER,
    ),
    notes: notes.slice(0, MAX_NOTES),
  };
}
