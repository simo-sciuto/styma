<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# STYMA

Applicazione per chi compra oggetti usati e vuole sapere, sul posto, se conviene comprarli.
Il PRD di riferimento e' `PROJECT_PRD.md`.

## Come e' organizzato

- `src/app` — route e API. Le route orchestrano, non contengono logica di business.
- `src/features` — componenti di flusso lato client (per ora solo `analyze`).
- `src/components` — primitive UI riusabili.
- `src/schemas` — schemi Zod per l'input esterno (output del modello) e tipi di dominio.
- `src/services/ai` — integrazione col modello, isolata dietro `ObjectIntelligenceProvider`.
  La ricerca di mercato gira su corsie parallele con mandati disgiunti (`config.ts`) e i
  risultati vengono ricomposti da `merge.ts`.
- `src/services/valuation` — forbice di prezzo e flip score. Codice puro, testato.
- `src/services/inventory` — lettura e scrittura degli oggetti salvati.
- `src/services/market-cache` — riuso delle ricerche di mercato per modello, con scadenza
  per ritmo di mercato. `policy.ts` e' puro e testato.
- `src/services/market-data` — fonti strutturate: eBay Browse API per le inserzioni con prezzo,
  Discogs per il catalogo musicale. Vengono prima della ricerca col modello, che parte solo se
  questi non bastano.
- `src/lib` — utilita' (upload, immagini, formattazione, rate limit) e client Supabase.
- `supabase/migrations` — schema e policy RLS.

## Regole che valgono per tutto il progetto

- **Il modello non decide il prezzo.** Identifica l'oggetto e trova comparabili; la valutazione
  e' aritmetica su quei dati, in `src/services/valuation`. Se i comparabili non ci sono, il
  prodotto dice che non lo sa: non si inventa mai un numero per riempire la UI.
- **Tutto cio' che arriva dal modello passa da uno schema Zod** prima di entrare nell'applicazione.
- **Niente SDK inizializzati a livello di modulo**: `next build` valuta le route senza variabili
  d'ambiente e fallirebbe. Vedi `src/services/ai/anthropic/client.ts`.
- **I numeri della valutazione stanno in `src/services/valuation/config.ts`**, non sparsi nel codice.
- **Ogni tabella ha RLS attiva** e la proprieta' si verifica risalendo a `items.user_id`, mai
  duplicando `user_id` sulle tabelle figlie: due fonti di verita' divergono.
- **Le valutazioni sono immutabili.** Una nuova analisi inserisce una riga, non aggiorna la vecchia.
- **Le corsie di ricerca vanno deduplicate.** Piu' corsie possono trovare la stessa pagina: contarla
  due volte gonfia il campione e quindi la confidenza. La deduplica per URL normalizzato sta in
  `src/services/ai/merge.ts` ed e' testata.
- **Sviluppare non deve costare.** `STYMA_AI_FIXTURES=1` rigioca le risposte registrate in
  `bench/fixtures` senza chiamare il modello; `STYMA_AI_RECORD=1` ne registra di nuove pagando una
  volta. Entrambe rifiutano di partire in produzione: servire un'analisi registrata come fresca
  sarebbe la peggiore bugia possibile, visto che qui il numero *e'* il prodotto.
- **Il costo di ogni analisi si misura**, non si stima a occhio: `src/services/ai/usage.ts` conta
  token, ricerche e dollari, e li scrive nei log del server. Il listino sta in `config.ts`.
- **I prezzi si cercano prima dove sono dati, poi dove sono pagine.** Una ricerca agentica sul web
  e' costata 300.000 token di input per analisi (~1,30 $); la stessa informazione da un'API arriva
  strutturata a costo zero. `src/services/market-data` viene interrogato per primo e la ricerca col
  modello parte solo sotto `ENOUGH_COMPARABLES`.
- **Discogs misura la concorrenza, non la domanda.** `num_for_sale` dice quante copie sono in
  vendita, cioe' quante alternative ha chi compra. Dedurne la domanda sarebbe un'invenzione:
  `demand` e `liquidity` restano `unknown` finche' nessuno ha guardato i venduti. E `lowest_price`
  e' un pavimento, non una media: non entra fra i comparabili, si dichiara come pavimento.
- **Le inserzioni attive sono `asking`, mai `sold`.** La Browse API restituisce annunci in corso.
  Spacciarli per vendite concluse sarebbe la bugia piu' facile da fare qui, e la piu' costosa: il
  peso di una vendita conclusa e' quasi il doppio.
- **Una ricerca riusata si dichiara.** La cache riusa i comparabili di un modello gia' cercato
  (30 giorni per il modernariato, 14 per il medio, 7 per l'elettronica, che si deprezza a gradini).
  L'interfaccia dice sempre quanti giorni ha la ricerca: un dato riusato che sembra fresco e'
  esattamente la bugia che questo prodotto non puo' dire.
- **La cache non si scrive dai client.** `market_research_cache` ha RLS attiva e zero policy: ci
  arriva solo il server con `SUPABASE_SERVICE_ROLE_KEY`. Una cache condivisa scrivibile dal browser
  si avvelena, e comparabili inventati sposterebbero le valutazioni di tutti.
- **Le attese lunghe si raccontano mentre accadono.** `/api/valuate` risponde in SSE e riporta ogni
  corsia quando finisce davvero. Nessuna barra di avanzamento che si muove da sola.
- Interfaccia in italiano, identificatori in inglese.

## Comandi

```
npm run dev        # sviluppo
npm run build      # build di produzione
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest (valutazione, fusione delle corsie, lettura dello stream)

node bench/research-bench.mjs [foto.jpg]   # cronometra e conta i costi di un'analisi contro `npm run dev`
```

## Configurazione

`.env.local` (vedi `.env.example`):

- `ANTHROPIC_API_KEY` — senza, l'interfaccia funziona ma le API di analisi rispondono 503.
- `STYMA_AI_FIXTURES` / `STYMA_AI_RECORD` — sviluppo gratuito su risposte registrate.
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` — senza, l'analisi funziona e
  l'inventario si disattiva da solo dichiarandolo, invece di rompersi.
- `SUPABASE_SERVICE_ROLE_KEY` — solo lato server, mai con prefisso `NEXT_PUBLIC_`. Senza, la cache
  delle ricerche si spegne da sola e ogni analisi paga la propria ricerca.
- `DISCOGS_TOKEN` — facoltativo, alza solo il limite di richieste. Senza, Discogs risponde lo stesso.
- `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_ENV` — prezzi strutturati. Senza, si ricade sulla
  ricerca col modello. Il sandbox si autentica ma non ha inserzioni: per dati veri serve
  `EBAY_ENV=production` con un keyset di produzione attivo.

Sul progetto Supabase servono gli accessi anonimi attivi, il bucket privato `item-photos` e un
SMTP configurato perche' la conferma email funzioni oltre le poche unita' l'ora del mailer interno.
