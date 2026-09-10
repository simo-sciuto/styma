/**
 * Quanto ci costa trattare un'asta in corso come un prezzo richiesto.
 *
 * La Browse API restituisce `bidCount` e `currentBidPrice` sugli oggetti
 * all'asta, e noi non li leggiamo: l'offerta corrente entra fra i comparabili
 * con la stessa etichetta e lo stesso peso del prezzo che un venditore chiede
 * per un pezzo fisso. Ma le due cifre hanno bias opposti — un prezzo richiesto
 * sta sopra il mercato, un'offerta a meta' corsa sta sotto — e mescolarle
 * senza distinguerle sposta la stima in una direzione che non sappiamo.
 *
 *   node bench/auction-bids.mjs "olivetti valentine" [altre query...]
 */
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);

const MARKETPLACES = ['EBAY_IT', 'EBAY_DE', 'EBAY_GB', 'EBAY_ES', 'EBAY_FR'];
const HOST = env.EBAY_ENV === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';

async function token() {
  const basic = Buffer.from(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${HOST}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });
  if (!response.ok) throw new Error(`token ${response.status}: ${await response.text()}`);
  return (await response.json()).access_token;
}

async function search(access, marketplace, query, buyingOptions = 'FIXED_PRICE|AUCTION') {
  const url = new URL(`${HOST}/buy/browse/v1/item_summary/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '20');
  url.searchParams.set('filter', `buyingOptions:{${buyingOptions}}`);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${access}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace },
  });
  if (!response.ok) return [];
  return (await response.json()).itemSummaries ?? [];
}

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const eur = (n) => (n === null ? '—' : `${n.toFixed(2)} €`);

const queries = process.argv.slice(2);
if (queries.length === 0) {
  console.error('uso: node bench/auction-bids.mjs "query" ["altra query"]');
  process.exit(1);
}

const access = await token();

for (const query of queries) {
  const found = (
    await Promise.all(MARKETPLACES.map((marketplace) => search(access, marketplace, query)))
  ).flat();

  const fixed = [];
  const auctionNoBids = [];
  const auctionWithBids = [];

  for (const item of found) {
    const price = Number(item.price?.value);
    if (!Number.isFinite(price) || price <= 0) continue;
    const options = item.buyingOptions ?? [];
    const bids = item.bidCount ?? 0;

    if (!options.includes('AUCTION')) {
      fixed.push({ price, title: item.title });
      continue;
    }

    const hoursLeft = item.itemEndDate
      ? (Date.parse(item.itemEndDate) - Date.now()) / 3_600_000
      : null;
    const entry = {
      price: Number(item.currentBidPrice?.value ?? price),
      bids,
      hoursLeft,
      title: item.title,
    };
    (bids > 0 ? auctionWithBids : auctionNoBids).push(entry);
  }

  const fixedMedian = median(fixed.map((x) => x.price));

  console.log(`\n${'═'.repeat(70)}\n"${query}" — ${found.length} inserzioni su 5 mercati`);
  console.log(`  prezzo fisso           ${String(fixed.length).padStart(3)}  mediana ${eur(fixedMedian)}`);
  console.log(
    `  aste senza offerte     ${String(auctionNoBids.length).padStart(3)}  mediana ${eur(median(auctionNoBids.map((x) => x.price)))}`,
  );
  console.log(
    `  aste CON offerte       ${String(auctionWithBids.length).padStart(3)}  mediana ${eur(median(auctionWithBids.map((x) => x.price)))}`,
  );

  if (auctionWithBids.length > 0 && fixedMedian) {
    const withBidsMedian = median(auctionWithBids.map((x) => x.price));
    const gap = (withBidsMedian / fixedMedian - 1) * 100;
    console.log(
      `\n  Le aste con offerte stanno il ${gap.toFixed(0)}% ${gap < 0 ? 'SOTTO' : 'sopra'} la mediana dei prezzi fissi.`,
    );
    console.log('  Oggi entrano nella stima con quella cifra, etichettate "prezzo richiesto".\n');

    for (const a of auctionWithBids.sort((x, y) => (x.hoursLeft ?? 1e9) - (y.hoursLeft ?? 1e9))) {
      const left = a.hoursLeft === null ? '     ?' : `${a.hoursLeft.toFixed(0).padStart(4)}h`;
      console.log(
        `    ${left}  ${String(a.bids).padStart(3)} offerte  ${eur(a.price).padStart(10)}  ${a.title.slice(0, 44)}`,
      );
    }
  }
}
