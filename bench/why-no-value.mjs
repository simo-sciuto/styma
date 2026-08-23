/**
 * Perche' un'analisi non produce un valore.
 *
 * Segue l'imbuto per intero — identificazione, query, inserzioni trovate,
 * comparabili tenuti e scartati con il motivo — perche' "nessuna stima" ha
 * almeno quattro cause diverse e da fuori sembrano tutte uguali.
 *
 *   node bench/why-no-value.mjs foto1.jpg foto2.jpg ...
 */
import fs from 'node:fs';

const BASE = process.env.STYMA_URL ?? 'http://localhost:3000';

async function analyse(photo) {
  const form = new FormData();
  form.append('images', new Blob([fs.readFileSync(photo)], { type: 'image/jpeg' }), 'foto.jpg');
  const idRes = await fetch(`${BASE}/api/identify`, { method: 'POST', body: form });
  if (!idRes.ok) return { photo, error: `identify ${idRes.status}: ${(await idRes.text()).slice(0, 120)}` };
  const { identification } = await idRes.json();

  const res = await fetch(`${BASE}/api/valuate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identification, purchasePrice: null }),
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', result = null, sourceLine = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n'); buf = parts.pop() ?? '';
    for (const p of parts) {
      const line = p.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const e = JSON.parse(line.slice(5).trim());
      if (e.type === 'result') result = e.result;
      if (e.type === 'source') sourceLine = e;
    }
  }
  return { photo, identification, sourceLine, result };
}

for (const photo of process.argv.slice(2)) {
  const { identification: id, sourceLine, result, error } = await analyse(photo);
  console.log('\n' + '─'.repeat(78));
  if (error) { console.log(photo, '→', error); continue; }

  console.log(`${photo.split('/').pop()}  —  ${id.name}`);
  console.log(`  marca: ${id.brand ?? 'NULL'} | modello: ${id.model ?? 'NULL'} | confidenza: ${id.confidence}`);
  // La query vera taglia la coda del modello: mostrarla intera direbbe una bugia.
  const core = (m) => (m ?? '').split(/\s+(?:con|with|avec|mit|piu'|più|\+|e)\s+|[,(/]/i)[0].trim();
  console.log(`  query eBay: "${[id.brand, core(id.model)].filter(Boolean).join(' ') || '(ripiego su searchQueries)'}"`);
  console.log(`  inserzioni trovate: ${sourceLine ? sourceLine.comparables : 0}`);

  const v = result?.valuation;
  if (!v) { console.log('  nessun risultato'); continue; }

  if (v.available) {
    console.log(`  ESITO: ${v.low}-${v.high} EUR, probabile ${v.likely} (${v.confidence})`);
    console.log(`  usati ${v.used.length}, scartati ${v.discarded.length}`);
    const w = v.used.map((u) => u.weight);
    if (w.length) console.log(`  pesi: min ${Math.min(...w).toFixed(2)} / max ${Math.max(...w).toFixed(2)}`);
    const lv = v.used.reduce((a, u) => { a[u.comparable.matchLevel] = (a[u.comparable.matchLevel] ?? 0) + 1; return a; }, {});
    console.log(`  somiglianza: ${Object.entries(lv).map(([k, n]) => `${k}=${n}`).join(' ') || '—'}`);
  } else {
    console.log(`  ESITO: NESSUNA STIMA — ${v.reason}`);
    console.log(`  scartati: ${v.discarded.length}`);
  }
  const byReason = (v.discarded ?? []).reduce((a, d) => { const k = d.reason.slice(0, 52); a[k] = (a[k] ?? 0) + 1; return a; }, {});
  for (const [reason, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(3)} × ${reason}`);
  }
}
