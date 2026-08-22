/**
 * Cronometra un'analisi reale contro il server di sviluppo.
 *
 * Passa dalla route vera, quindi misura i prompt, la configurazione delle
 * corsie e la fusione che girano davvero in produzione: un banco di prova che
 * si ricopia lo schema si stacca dal codice al primo cambiamento, e a quel
 * punto misura qualcos'altro.
 *
 *   npm run dev
 *   node bench/research-bench.mjs [percorso/di/una/foto.jpg]
 *
 * Senza argomenti riusa l'identificazione salvata in bench/ident.json e
 * cronometra la sola ricerca di mercato, che e' la fase lenta.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.STYMA_URL ?? 'http://localhost:3000';
const here = path.dirname(new URL(import.meta.url).pathname);

const since = (start) => `${((Date.now() - start) / 1000).toFixed(1)}s`.padStart(7);

const usdOf = (usage) =>
  usage ? ` — $${usage.usd.toFixed(4)} (${usage.webSearches} ricerche, in ${usage.inputTokens.toLocaleString('it-IT')} / out ${usage.outputTokens.toLocaleString('it-IT')})` : '';

async function identify(photoPath) {
  const start = Date.now();
  const form = new FormData();
  form.append('images', new Blob([fs.readFileSync(photoPath)], { type: 'image/jpeg' }), 'foto.jpg');

  const response = await fetch(`${BASE}/api/identify`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`identify ${response.status}: ${await response.text()}`);

  const { identification, usage } = await response.json();
  console.log(`${since(start)}  identificazione — ${identification.name}${usdOf(usage)}`);
  return { identification, usage };
}

async function research(identification) {
  const start = Date.now();
  const response = await fetch(`${BASE}/api/valuate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identification, purchasePrice: 120 }),
  });
  if (!response.ok) throw new Error(`valuate ${response.status}: ${await response.text()}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;
  let usage = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const line = chunk.split('\n').find((candidate) => candidate.startsWith('data:'));
      if (!line) continue;
      const event = JSON.parse(line.slice(5).trim());

      if (event.type === 'lanes') {
        console.log(`${since(start)}  partono ${event.lanes.length} corsie in parallelo`);
      } else if (event.type === 'lane') {
        const detail = event.lane.status === 'failed' ? 'FALLITA' : `${event.lane.comparables} comparabili`;
        console.log(`${since(start)}  corsia "${event.lane.label}" — ${detail}`);
      } else if (event.type === 'cache') {
        console.log(
          `${since(start)}  RIUSO dalla cache — ricerca di ${event.ageDays} giorni fa, ${event.comparables} comparabili, nessuna chiamata al modello`,
        );
      } else if (event.type === 'usage') {
        usage = event.usage;
      } else if (event.type === 'result') {
        result = event.result;
        console.log(`${since(start)}  risultato`);
      } else {
        console.log(`${since(start)}  errore: ${event.error}`);
      }
    }
  }

  return { result, usage, seconds: (Date.now() - start) / 1000 };
}

const photo = process.argv[2];
const identified = photo
  ? await identify(photo)
  : { identification: JSON.parse(fs.readFileSync(path.join(here, 'ident.json'), 'utf8')).identification, usage: null };

const { result, usage, seconds } = await research(identified.identification);

console.log(`\nRicerca di mercato: ${seconds.toFixed(1)}s${usdOf(usage)}`);
if (identified.usage || usage) {
  const total = (identified.usage?.usd ?? 0) + (usage?.usd ?? 0);
  console.log(`Costo dell'analisi completa: $${total.toFixed(4)}`);
}
if (result?.market) {
  const sold = result.market.comparables.filter((c) => c.kind === 'sold').length;
  console.log(
    `Comparabili dopo la fusione: ${result.market.comparables.length} (${sold} vendite concluse)`,
  );
  console.log(`Domanda ${result.market.demand} · liquidita' ${result.market.liquidity}`);
}
console.log(
  result?.valuation.available
    ? `Forbice: ${result.valuation.low}–${result.valuation.high} €, probabile ${result.valuation.likely} € (confidenza ${result.valuation.confidence})`
    : `Nessuna stima: ${result?.valuation.reason ?? 'sconosciuto'}`,
);
