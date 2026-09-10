/**
 * Quanti comparabili sono accessori dell'oggetto invece dell'oggetto.
 *
 * `inferMatchLevel` legge marca e modello nel titolo, e un ricambio li porta
 * entrambi: «Cinghie per custodia Olivetti Valentine - Set da 2» a 55 € entra
 * come *stesso modello* con peso pieno nella stima di una macchina da
 * scrivere da 240 €. Lo scarto dei prezzi fuori scala non lo prende, perche'
 * 55 su 240 non e' cinque volte sotto il mediano.
 *
 * Prima di accendere un filtro va misurato quanto taglia e cosa: un elenco di
 * parole troppo largo toglie comparabili veri, ed e' un danno peggiore.
 *
 *   node bench/accessories.mjs
 */
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);

const HOST = 'https://api.ebay.com';
const MARKETPLACES = ['EBAY_IT', 'EBAY_DE', 'EBAY_GB', 'EBAY_ES', 'EBAY_FR'];

const basic = Buffer.from(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`).toString('base64');
const { access_token: token } = await (
  await fetch(`${HOST}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  })
).json();

async function cerca(query) {
  const trovate = [];
  for (const marketplace of MARKETPLACES) {
    const url = new URL(`${HOST}/buy/browse/v1/item_summary/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '20');
    url.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE|AUCTION}');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace },
    });
    if (!response.ok) continue;
    const { itemSummaries = [] } = await response.json();
    for (const item of itemSummaries) {
      const price = Number(item.price?.value ?? item.currentBidPrice?.value);
      if (Number.isFinite(price) && price > 0) trovate.push({ title: item.title, price });
    }
  }
  return trovate;
}

/**
 * Parole che nominano un accessorio, un ricambio o un pezzo di carta.
 *
 * Volutamente prive delle ambigue. "manuale" e "manual" sono fuori: una
 * macchina da scrivere e' manuale e una Nikon FM2 e' una "manual camera" —
 * l'elenco largo scartava proprio gli oggetti. Fuori anche "solo"/"only":
 * "solo corpo" e' una reflex senza obiettivo, cioe' un comparabile ottimo.
 */
const ACCESSORI = new Set([
  'cinghia', 'cinghie', 'tracolla', 'strap', 'straps', 'riemen', 'kofferriemen',
  'sangle', 'correa',
  'custodia', 'fodero', 'astuccio', 'housse', 'etui', 'funda', 'lanieres', 'laniere',
  'cover', 'copertura', 'coperchio', 'copertina',
  'ricambio', 'ricambi', 'ersatz', 'ersatzteil', 'ersatzteile', 'repuesto', 'spare',
  'gommini', 'gommino', 'tappini', 'tappino', 'spalla', 'spalle',
  'farbband', 'nastro', 'nastri', 'ribbon', 'ruban',
  'adesivo', 'adesivi', 'sticker', 'aufkleber', 'pegatina',
  'catalogo', 'catalogue', 'brochure', 'depliant', 'prospekt', 'werbung', 'advert',
  'targhetta', 'etichetta', 'label',
  'caricabatterie', 'charger', 'alimentatore', 'netzteil', 'cargador',
  'cavo', 'cable', 'kabel', 'adattatore', 'adapter', 'adaptador',
  'paraluce', 'hood', 'copriobiettivo', 'tappo', 'deckel', 'bouchon', 'tapa',
  'filtro', 'filtri', 'filter', 'filtre',
  'treppiede', 'tripod', 'stativ', 'staffa', 'halterung', 'tischhalterung',
  'morsetto', 'abrazadera', 'bracket', 'pinza',
]);

/**
 * Parole che trasformano l'accessorio in qualcosa di *incluso* invece che nel
 * soggetto: "con correa", "mit Riemen", "with case". La parola resta la
 * stessa, il senso si ribalta.
 *
 * Non ci sono "per", "für", "pour", "para", "for": quelle dicono il contrario
 * — "Cinghie **per** custodia" vende cinghie.
 */
const INCLUSO = new Set([
  'con', 'mit', 'with', 'avec', 'w', 'incl', 'inklusive', 'including', 'compreso',
  'completo', 'complete', 'komplett', 'e', 'and', 'und', 'et', 'y', 'plus', 'mas',
]);

/** Un insieme di N pezzi non e' mai l'oggetto: e' un lotto di ricambi. */
const SET_DI_N = /\b(set (da|di|of) \d|\d ?er-set|lot(to)? (de|di) \d|paio di|pair of|\d ?x |\d (pezzi|pcs|stuck|st))/i;

function normalizza(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Se l'inserzione vende un accessorio invece dell'oggetto.
 *
 * La parola non basta: "Typewriter with Case" e "Case Straps" contengono
 * entrambe "case". Quello che cambia e' la **posizione**: il soggetto di un
 * titolo sta all'inizio, e chi vende un ricambio lo nomina per primo perche'
 * e' quello che vende. Dopo la marca, la stessa parola descrive cosa c'e'
 * insieme all'oggetto.
 *
 * L'eccezione e' il lotto di N pezzi: "Case Straps - Set of 2" nomina
 * l'accessorio dopo la marca, ma un insieme di due non e' mai l'oggetto.
 */
function accessorio(title, objectType, query) {
  const parole = normalizza(title).split(' ').filter(Boolean);
  const proprie = new Set(normalizza(objectType).split(' ').filter(Boolean));
  const candidate = parole.filter((parola) => ACCESSORI.has(parola) && !proprie.has(parola));
  if (candidate.length === 0) return null;

  // Il soggetto sta prima della marca: "Cinghie per custodia Olivetti
  // Valentine" vende cinghie, "Olivetti Valentine con custodia" vende la
  // macchina. Senza marca nel titolo si ripiega sulle prime due parole.
  const marca = new Set(normalizza(query).split(' ').filter(Boolean));
  const doveInizia = parole.findIndex((parola) => marca.has(parola));
  const limite = doveInizia >= 0 ? doveInizia : 2;
  const prima = parole
    .slice(0, limite)
    .find((parola, indice) => candidate.includes(parola) && !INCLUSO.has(parole[indice - 1] ?? ''));
  if (prima) return prima;

  return SET_DI_N.test(title) ? `${candidate[0]} + lotto` : null;
}

const CASI = [
  { query: 'Olivetti Valentine', objectType: 'macchina da scrivere' },
  { query: 'Canon AE-1', objectType: 'reflex 35mm' },
  { query: 'Artemide Tolomeo', objectType: 'lampada da tavolo' },
  { query: 'Nikon FM2', objectType: 'reflex 35mm' },
  { query: 'Seiko 5 automatic', objectType: 'orologio da polso' },
];

const mediana = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);

for (const { query, objectType } of CASI) {
  const trovate = await cerca(query);
  const scartate = [];
  const tenute = [];
  for (const item of trovate) {
    const motivo = accessorio(item.title, objectType, query);
    (motivo ? scartate : tenute).push({ ...item, motivo });
  }

  const prima = mediana(trovate.map((x) => x.price));
  const dopo = mediana(tenute.map((x) => x.price));

  /*
   * Estensione da valutare: la parola accessorio compare ovunque nel titolo
   * (non solo in testa) e il prezzo sta molto sotto il mediano. Un ricambio
   * nominato dopo la marca — "Valentine Typewriter Ink Ribbon" — sfugge alla
   * regola di posizione, ma un nastro non costa un trentesimo della macchina
   * per caso.
   */
  const soglia = dopo === null ? 0 : dopo / 3;
  const ancoraAccessori = tenute.filter((item) => {
    const parole = normalizza(item.title).split(' ').filter(Boolean);
    const proprie = new Set(normalizza(objectType).split(' ').filter(Boolean));
    return item.price < soglia && parole.some((w) => ACCESSORI.has(w) && !proprie.has(w));
  });
  console.log(`  — estensione "parola ovunque + sotto ${soglia.toFixed(0)} €": altre ${ancoraAccessori.length}`);
  for (const a of ancoraAccessori.slice(0, 8)) {
    console.log(`    ${a.price.toFixed(0).padStart(5)} €  ${a.title.slice(0, 58)}`);
  }

  console.log(`\n${'═'.repeat(78)}\n${query} — ${trovate.length} inserzioni`);
  console.log(
    `  tenute ${tenute.length}, scartate ${scartate.length}` +
      `  |  mediana ${prima?.toFixed(0)} € → ${dopo?.toFixed(0)} €`,
  );
  console.log('  — scartate:');
  for (const s of scartate.slice(0, 12)) {
    console.log(`    ${s.price.toFixed(0).padStart(5)} €  [${s.motivo}]  ${s.title.slice(0, 52)}`);
  }
  const economiche = tenute.sort((a, b) => a.price - b.price).slice(0, 4);
  console.log('  — le piu\' economiche fra quelle TENUTE (controllo falsi negativi):');
  for (const t of economiche) {
    console.log(`    ${t.price.toFixed(0).padStart(5)} €  ${t.title.slice(0, 60)}`);
  }
}
