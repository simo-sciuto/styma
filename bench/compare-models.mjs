/**
 * Confronta i modelli sull'identificazione, che ora e' l'unico costo fisso.
 *
 * La domanda non e' "quale costa meno" — quella ha risposta ovvia — ma "quale
 * legge marca e modello". Sono i due campi che decidono se la ricerca eBay
 * trova cinquantasei comparabili esatti o diciannove di categoria, quindi un
 * modello che sbaglia li' costa molto piu' di quanto risparmia.
 *
 * Si paga una volta per decidere una volta:
 *   node bench/compare-models.mjs foto1.jpg foto2.jpg ...
 */
import fs from 'node:fs';
import Anthropic from '../node_modules/@anthropic-ai/sdk/index.mjs';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const PRICES = {
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [3, 15],
  'claude-haiku-4-5': [1, 5],
};

const SYSTEM = fs.readFileSync(new URL('../src/services/ai/anthropic/prompts.ts', import.meta.url), 'utf8')
  .split('export const IDENTIFICATION_SYSTEM_PROMPT = `')[1].split('`;')[0];

/** Schema minimo: bastano i campi che decidono la ricerca. */
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'brand', 'model', 'confidence'],
  properties: {
    name: { type: 'string' },
    brand: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    model: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    confidence: { type: 'number' },
  },
};

const photos = process.argv.slice(2);
if (photos.length === 0) {
  console.error('Serve almeno una foto.');
  process.exit(1);
}

for (const model of Object.keys(PRICES)) {
  let usd = 0;
  console.log(`\n${'═'.repeat(70)}\n${model}`);
  for (const photo of photos) {
    const data = fs.readFileSync(photo).toString('base64');
    const started = Date.now();
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 2000,
        system: SYSTEM,
        output_config: { format: { type: 'json_schema', schema } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
            { type: 'text', text: 'Identifica questo oggetto.' },
          ],
        }],
      });
      const [pin, pout] = PRICES[model];
      const cost = (response.usage.input_tokens * pin + response.usage.output_tokens * pout) / 1e6;
      usd += cost;
      const out = JSON.parse(response.content.find((b) => b.type === 'text').text);
      console.log(`  ${photo.split('/').pop().padEnd(34)} ${((Date.now() - started) / 1000).toFixed(1)}s  $${cost.toFixed(4)}`);
      console.log(`     marca: ${out.brand ?? 'NULL'} | modello: ${out.model ?? 'NULL'} | conf ${out.confidence}`);
    } catch (error) {
      console.log(`  ${photo.split('/').pop().padEnd(34)} ERRORE: ${String(error).slice(0, 110)}`);
    }
  }
  console.log(`  ── totale ${model}: $${usd.toFixed(4)} su ${photos.length} foto`);
}
