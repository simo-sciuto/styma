import * as z from 'zod/v4';

import type { Identification } from '@/schemas/identification';

/**
 * Discogs, e cosa da' davvero.
 *
 * Senza autenticazione l'API espone la ricerca nel catalogo e, per ogni
 * edizione, quante copie sono in vendita e a quanto sta la piu' economica.
 * NON espone lo storico delle vendite: `marketplace/price_suggestions`
 * risponde 401 e richiede OAuth con un account venditore. Quindi da qui non
 * arrivano prezzi di vendita, arriva il pavimento del mercato e la
 * concorrenza — che per chi rivende sono comunque due numeri che contano.
 *
 * Il catalogo serve anche a un'altra cosa: conferma etichetta, anno e numero
 * di catalogo, e con quelli si costruisce una query molto piu' precisa per le
 * fonti che i prezzi ce li hanno.
 */

const API = 'https://api.discogs.com';
const USER_AGENT = 'Styma/0.1 +https://github.com/simo-sciuto/styma';

/** Categorie in cui Discogs ha senso. Fuori di qui non e' il catalogo giusto. */
// I confini di parola servono a due cose opposte: fare in modo che "lp" e "cd"
// non peschino dentro altre parole, e che "record" non peschi "recorder", che e'
// un registratore e non un disco. Gli stem prendono il suffisso con `\w*`.
const MUSIC_HINTS =
  /\b(?:musicassett\w*|cassett\w*|disc[hoi]\w*|vinil[ei]|vinyl|33\s*giri|45\s*giri|album|musica|record|lp|cd)\b/i;

export function looksLikeMusic(identification: Identification): boolean {
  return (
    MUSIC_HINTS.test(identification.category) ||
    MUSIC_HINTS.test(identification.name) ||
    identification.materials.some((material) => MUSIC_HINTS.test(material))
  );
}

const SearchResponseSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        title: z.string(),
        year: z.union([z.string(), z.number()]).optional(),
        label: z.array(z.string()).optional(),
        catno: z.string().optional(),
        country: z.string().optional(),
        uri: z.string().optional(),
      }),
    )
    .optional(),
});

const StatsSchema = z.object({
  num_for_sale: z.number().optional(),
  lowest_price: z
    .object({ value: z.number(), currency: z.string() })
    .nullable()
    .optional(),
});

export type DiscogsRelease = {
  id: number;
  title: string;
  year: string | null;
  label: string | null;
  catno: string | null;
  url: string;
  /** Copie attualmente in vendita: e' concorrenza, non domanda. */
  numForSale: number | null;
  /** La copia piu' economica in vendita. E' un pavimento, non una media. */
  lowestPrice: { value: number; currency: string } | null;
};

async function get(path: string): Promise<unknown | null> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
  // Il token e' facoltativo: serve solo ad alzare il limite di richieste,
  // non a sbloccare dati diversi.
  const token = process.env.DISCOGS_TOKEN;
  if (token) headers.Authorization = `Discogs token=${token}`;

  const response = await fetch(`${API}${path}`, { headers });
  if (!response.ok) return null;
  return response.json();
}

/**
 * Cerca l'edizione nel catalogo Discogs e ne legge la situazione di mercato.
 * Null quando non e' musica, quando non si trova, o quando Discogs non
 * risponde: e' una fonte in piu', non una dipendenza.
 */
export async function lookupRelease(
  identification: Identification,
): Promise<DiscogsRelease | null> {
  if (!looksLikeMusic(identification)) return null;

  const query = [identification.brand, identification.model, identification.name]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .slice(0, 2)
    .join(' ');
  if (query.trim() === '') return null;

  try {
    const searchRaw = await get(
      `/database/search?q=${encodeURIComponent(query)}&type=release&per_page=5`,
    );
    const search = SearchResponseSchema.safeParse(searchRaw);
    const first = search.success ? search.data.results?.[0] : undefined;
    if (!first) return null;

    const statsRaw = await get(`/marketplace/stats/${first.id}`);
    const stats = StatsSchema.safeParse(statsRaw);

    return {
      id: first.id,
      title: first.title,
      year: first.year === undefined ? null : String(first.year),
      label: first.label?.[0] ?? null,
      catno: first.catno ?? null,
      url: first.uri?.startsWith('http') ? first.uri : `https://www.discogs.com/release/${first.id}`,
      numForSale: stats.success ? (stats.data.num_for_sale ?? null) : null,
      lowestPrice: stats.success ? (stats.data.lowest_price ?? null) : null,
    };
  } catch (error) {
    console.warn('[discogs] consultazione fallita', error);
    return null;
  }
}

/**
 * Cosa dire a chi rivende. Sono osservazioni, non inferenze: il numero di
 * copie in vendita misura la concorrenza, e dedurne la domanda sarebbe
 * un'invenzione — per questo `demand` e `liquidity` restano "unknown".
 */
export function describeRelease(release: DiscogsRelease): string[] {
  const notes: string[] = [];

  const identity = [release.label, release.catno, release.year]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');
  if (identity) notes.push(`Discogs: ${release.title} (${identity}).`);

  if (release.numForSale !== null) {
    const competition =
      release.numForSale > 20
        ? 'molta concorrenza'
        : release.numForSale > 3
          ? 'concorrenza normale'
          : 'pochissime copie in giro';
    notes.push(`${release.numForSale} copie gia' in vendita su Discogs: ${competition}.`);
  }

  if (release.lowestPrice) {
    notes.push(
      `La copia piu' economica in vendita sta a ${release.lowestPrice.value} ${release.lowestPrice.currency}: sopra quella cifra serve una ragione per farsi scegliere.`,
    );
  }

  return notes;
}
