import type { Identification } from '@/schemas/identification';
import { coreModel } from '@/lib/model-name';

/**
 * Le query da provare, in ordine di precisione.
 *
 * Marca e modello sono i due campi su cui i titoli eBay sono affidabili, ma
 * meta' degli oggetti di un mercatino non ha ne' l'una ne' l'altro: un vaso
 * senza punzone, una lampada anonima. Per quelli l'identificazione produce
 * gia' `searchQueries`, scritte apposta per cercare comparabili — usarne una
 * sola, o ripiegarci solo quando marca e modello mancano entrambi, buttava via
 * l'unico appiglio disponibile.
 *
 * Provarne piu' di una non costa niente: eBay non si paga a chiamata.
 */
export function buildQueries(identification: Identification): string[] {
  const queries: string[] = [];
  const brand = identification.brand?.trim();
  // Senza tagliare la coda, "Canon AE-1 con FD 50mm f/1.8" trova una
  // inserzione su undicimila: la ricerca cerca la frase, non l'oggetto.
  const model = identification.model === null ? null : coreModel(identification.model);

  if (brand && model) {
    // "Morenita Morenita Express" cercava la marca due volte: se il modello la
    // contiene gia', ripeterla restringe senza aggiungere nulla.
    const modelHasBrand = model.toLowerCase().includes(brand.toLowerCase());
    queries.push(modelHasBrand ? model : `${brand} ${model}`);
  } else if (model) {
    queries.push(model);
  } else if (brand) {
    // La sola marca e' troppo larga per essere una query, e la categoria
    // merceologica non la restringe: "Fred Perry abbigliamento" restituisce
    // polo, maglioni e cappotti, i cui prezzi non c'entrano niente fra loro.
    // Il tipo di oggetto — la parola che il venditore mette nel titolo — e'
    // l'unica cosa che separa una polo da un maglione della stessa marca.
    queries.push(`${brand} ${identification.objectType || identification.category}`.trim());
  }

  queries.push(...identification.searchQueries.map((query) => query.trim()));

  const seen = new Set<string>();
  return queries.filter((query) => {
    const key = query.toLowerCase();
    if (query.length < 3 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Compatibilita': la prima query e' quella piu' precisa. */
export function buildQuery(identification: Identification): string | null {
  return buildQueries(identification)[0] ?? null;
}

/**
 * Il link alla ricerca "venduti" di eBay, con la nostra query gia' pronta.
 *
 * Le vendite concluse non entrano nella stima e non ci entreranno presto:
 * la Marketplace Insights API e' chiusa ai nuovi utenti, la Finding API e'
 * stata dismessa a febbraio 2025, e le uniche fonti che restituiscono davvero
 * un prezzo di vendita sono scraper. Quello che possiamo fare senza mentire e'
 * portarci chi sta davanti al banco: e' la sua ricerca, sul suo browser, sul
 * sito di eBay.
 *
 * Dal 22 luglio 2026 eBay chiede di essere loggati per vedere i venduti: chi
 * non lo e' finisce sulla pagina di accesso. Degrada in un login, non in un
 * numero sbagliato — ma va detto prima di far toccare il link.
 */
export function ebaySoldSearchUrl(identification: Identification, host = 'www.ebay.it'): string | null {
  const query = buildQuery(identification);
  if (query === null) return null;

  const url = new URL(`https://${host}/sch/i.html`);
  url.searchParams.set('_nkw', query);
  url.searchParams.set('LH_Sold', '1');
  url.searchParams.set('LH_Complete', '1');
  // Dal piu' recente: un venduto di ieri dice piu' di uno di tre mesi fa.
  url.searchParams.set('_sop', '13');
  return url.toString();
}
