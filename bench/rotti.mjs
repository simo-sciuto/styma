/**
 * Quanti comparabili dichiarano nel titolo di essere rotti o da ricambi.
 *
 * «Machine à écrire Olivetti Valentine Pour Pièces» a 60 € su una macchina da
 * 270 € e' entrata fra i comparabili con peso pieno, e da li' e' finita fra le
 * *occasioni*: il prodotto stava mandando qualcuno a comprare una macchina
 * rotta. Lo scarto dei prezzi fuori scala non la prende — 60 su 270 non e'
 * cinque volte sotto il mediano — e `conditionId` 7000 direbbe la stessa cosa
 * ma arriva su 3 inserzioni su 20.
 *
 * Come per gli accessori, prima di accendere un filtro va misurato quanto
 * taglia e cosa: un elenco troppo largo toglie comparabili veri, e quello e'
 * il danno peggiore perche' alza la stima.
 *
 *   node bench/rotti.mjs
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
    url.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE}');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace },
    });
    if (!response.ok) continue;
    const { itemSummaries = [] } = await response.json();
    for (const item of itemSummaries) {
      const price = Number(item.price?.value);
      if (Number.isFinite(price) && price > 0) {
        trovate.push({ title: item.title, price, conditionId: item.conditionId ?? null });
      }
    }
  }
  return trovate;
}

// Le stesse frasi di `src/services/market-data/ebay/mapping.ts`.
const BROKEN_PHRASES = [
  'per ricambi', 'per pezzi', 'per parti', 'non funzionante', 'non funziona',
  'da riparare', 'da revisionare', 'da restaurare', 'difettoso', 'guasta', 'guasto',
  'pour pieces', 'pour piece', 'en panne', 'ne fonctionne pas', 'a reparer',
  'defekt', 'ersatzteil', 'ersatzteiltrager', 'bastler', 'zum basteln',
  'for parts', 'not working', 'spares or repair', 'spares repair',
  'spare parts', 'faulty', 'as spares',
  'para piezas', 'no funciona', 'averiado', 'para reparar', 'para restaurar',
];

const normalizza = (value) =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const frasiTrovate = (title) => BROKEN_PHRASES.filter((p) => normalizza(title).includes(p));

const QUERY = process.argv.slice(2);
const DEFAULT = [
  'olivetti valentine', 'canon ae-1', 'nikon fm2', 'artemide tolomeo',
  'braun sk4', 'rolleiflex', 'omega seamaster', 'vespa px125',
];

let totale = 0;
let scartati = 0;
const usoFrase = new Map();

for (const query of QUERY.length > 0 ? QUERY : DEFAULT) {
  const inserzioni = await cerca(query);
  if (inserzioni.length === 0) continue;

  const prezzi = inserzioni.map((i) => i.price).sort((a, b) => a - b);
  const mediano = prezzi[Math.floor(prezzi.length / 2)];
  const colpiti = inserzioni.filter((i) => frasiTrovate(i.title).length > 0);

  totale += inserzioni.length;
  scartati += colpiti.length;
  for (const i of colpiti) for (const f of frasiTrovate(i.title)) usoFrase.set(f, (usoFrase.get(f) ?? 0) + 1);

  console.log(`\n${query} — ${inserzioni.length} inserzioni, mediano ${mediano.toFixed(0)}`);
  console.log(`  scartate: ${colpiti.length} (${((colpiti.length / inserzioni.length) * 100).toFixed(0)}%)`);
  for (const i of colpiti.slice(0, 8)) {
    const sotto = ((1 - i.price / mediano) * 100).toFixed(0);
    console.log(`   ${String(i.price.toFixed(0)).padStart(6)}  (${sotto}% sotto il mediano)  ${i.title.slice(0, 78)}`);
    console.log(`           └ frase: ${frasiTrovate(i.title).join(', ')}${i.conditionId ? ` · conditionId ${i.conditionId}` : ' · condizione non dichiarata'}`);
  }
}

console.log(`\n─────────────────────────────────────────────`);
console.log(`totale ${totale} inserzioni, ${scartati} scartate (${((scartati / totale) * 100).toFixed(1)}%)`);
console.log(`\nfrasi che hanno davvero pescato qualcosa:`);
for (const [frase, n] of [...usoFrase].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${frase}`);
const mai = BROKEN_PHRASES.filter((f) => !usoFrase.has(f));
console.log(`\nfrasi che non hanno pescato niente (${mai.length}): ${mai.join(', ')}`);
