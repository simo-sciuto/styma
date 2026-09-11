/**
 * Da un link incollato a un annuncio che possiamo leggere.
 *
 * L'idea nasce da come si usa davvero il telefono: stai scorrendo Vinted, vedi
 * una cosa che forse conviene, e l'unico modo di saperlo e' uscire dall'app e
 * cercare a mano. Il link ce l'hai gia' in mano — e' l'unica cosa che quel
 * momento ti da' gratis.
 *
 * Due sorgenti sole, e non e' una limitazione tecnica.
 *
 * **eBay** si legge dalla Browse API, con le credenziali che gia' usiamo per i
 * comparabili: dati ufficiali, completi, autorizzati.
 *
 * **Vinted** si legge dalla pagina, e lo facciamo perche' loro dicono che si
 * puo'. Il `robots.txt` di vinted.it porta, per `User-Agent: *`,
 * `Allow: /` con `/items/` fuori da ogni disallow, e un segnale esplicito:
 * `Content-Signal: ai-train=no, search=yes, ai-input=yes`. «ai-input» e'
 * definito nel loro stesso file come «inputting content into one or more AI
 * models», che e' esattamente cio' che facciamo: una pagina per volta, su
 * richiesta di chi la sta guardando, senza addestrare niente. Se un giorno
 * quel segnale diventasse `no`, questa funzione va spenta, non aggirata.
 *
 * Tutto il resto — Subito, Wallapop, Marketplace — resta fuori finche' non
 * c'e' un'API o un segnale che lo permetta con la stessa chiarezza.
 */
export type ListingSource = 'vinted' | 'ebay';

export type ParsedListingUrl = {
  source: ListingSource;
  /** L'identificativo dell'annuncio nella sua piattaforma. */
  id: string;
  /** L'URL ripulito da parametri di tracciamento e frammenti. */
  url: string;
};

/**
 * I domini che sappiamo leggere.
 *
 * L'ancoraggio alla fine non e' pignoleria: questo URL lo apre il *nostro*
 * server, quindi la lista dei domini e' un controllo di sicurezza, non una
 * comodita'. La prima versione era `/(^|\.)vinted\.[a-z.]+$/`, e il punto
 * dentro la classe di caratteri rendeva valido `vinted.it.truffa.example`:
 * chiunque poteva farsi aprire una pagina qualunque dal nostro backend. Se
 * n'e' accorto un test, non una rilettura.
 *
 * Dopo `vinted.` o `ebay.` puo' esserci solo un dominio di primo livello, o
 * uno dei due di secondo livello che queste piattaforme usano davvero.
 */
const TLD = String.raw`(?:[a-z]{2,3}|co\.uk|com\.au)`;
const DOMINI: { pattern: RegExp; source: ListingSource }[] = [
  { pattern: new RegExp(String.raw`^(?:[a-z0-9-]+\.)*vinted\.${TLD}$`, 'i'), source: 'vinted' },
  { pattern: new RegExp(String.raw`^(?:[a-z0-9-]+\.)*ebay\.${TLD}$`, 'i'), source: 'ebay' },
];

/**
 * L'id dell'annuncio dentro il percorso.
 *
 * Vinted: `/items/9961066353-borsetta-a-tracolla…` — il numero, poi lo slug.
 * eBay:   `/itm/335678901234` oppure `/itm/slug/335678901234`.
 */
const PERCORSI: Record<ListingSource, RegExp> = {
  vinted: /\/items\/(\d{5,})/,
  ebay: /\/itm\/(?:[^/]+\/)?(\d{9,})/,
};

export function parseListingUrl(raw: string): ParsedListingUrl | null {
  const pulito = raw.trim();
  if (pulito === '') return null;

  // Chi incolla da un telefono spesso non porta lo schema.
  const conSchema = /^https?:\/\//i.test(pulito) ? pulito : `https://${pulito}`;

  let url: URL;
  try {
    url = new URL(conSchema);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const dominio = DOMINI.find((voce) => voce.pattern.test(url.hostname));
  if (!dominio) return null;

  const match = PERCORSI[dominio.source].exec(url.pathname);
  if (!match) return null;

  // Via i parametri: i link condivisi arrivano pieni di tracciamento, e due
  // link allo stesso annuncio devono essere lo stesso annuncio.
  return {
    source: dominio.source,
    id: match[1]!,
    url: `https://${url.hostname}${url.pathname}`,
  };
}

/** Come si chiama la piattaforma, per scriverlo in pagina. */
export const SOURCE_LABELS: Record<ListingSource, string> = {
  vinted: 'Vinted',
  ebay: 'eBay',
};

/**
 * Il titolo dell'annuncio ridotto a una query che eBay sappia usare.
 *
 * Misurato sull'annuncio che ha fatto nascere questa funzione, «Borsetta a
 * tracolla The North Face Base Camp High Pile Mini»:
 *
 *   titolo intero                              **0 risultati**
 *   tagliato alla marca                         3 risultati, centrati
 *   la nostra query generica                   21 risultati, piu' larghi
 *
 * Zero. Una query lunga su eBay cerca la frase, non l'oggetto, ed e' lo stesso
 * difetto che `coreModel` corregge sui nostri modelli: «Canon AE-1 con FD 50mm
 * f/1.8» passava da undicimila inserzioni a una.
 *
 * Le parole prima della marca sono quasi sempre come *chi vende* chiama la
 * categoria nella sua lingua («borsetta a tracolla»), e su cinque mercati
 * quella parola non compare nei titoli. Dalla marca in poi c'e' il nome del
 * prodotto, che e' internazionale. E' la stessa regola di posizione che
 * `looksLikeAccessory` usa sui comparabili: la marca segna il confine.
 *
 * Senza marca da cui tagliare si tengono le prime parole e basta: una query
 * lunga vale zero, quindi anche un taglio grezzo e' meglio di niente.
 */
/**
 * Otto parole e non sette, e la marca si cerca intera.
 *
 * Sette tagliavano «The North Face Base Camp High Pile **Mini**», cioe' la
 * parola che distingue quel modello da tutti gli altri Base Camp. E cercare
 * solo la prima parola della marca non funziona con marche che cominciano per
 * articolo: «The» si trova ovunque, e il taglio finiva nel punto sbagliato.
 */
const MAX_PAROLE_QUERY = 8;

const soloLettere = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

export function sellerQuery(title: string, brand: string | null): string | null {
  const pulito = title.replace(/\s+/g, ' ').trim();
  if (pulito.length < 3) return null;

  const parole = pulito.split(' ');
  const inizio = brand ? posizioneMarca(parole, brand) : -1;
  const da = inizio > 0 ? inizio : 0;

  return parole.slice(da, da + MAX_PAROLE_QUERY).join(' ');
}

/** Dove comincia la marca, cercata come frase intera e non parola per parola. */
function posizioneMarca(parole: string[], brand: string): number {
  const cercate = brand.split(/\s+/).map(soloLettere).filter(Boolean);
  if (cercate.length === 0) return -1;

  const normalizzate = parole.map(soloLettere);
  for (let i = 0; i + cercate.length <= normalizzate.length; i += 1) {
    if (cercate.every((parola, k) => normalizzate[i + k] === parola)) return i;
  }
  return -1;
}
