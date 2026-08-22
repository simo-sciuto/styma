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
- `src/services/valuation` — forbice di prezzo e flip score. Codice puro, testato.
- `src/services/inventory` — lettura e scrittura degli oggetti salvati.
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
- Interfaccia in italiano, identificatori in inglese.

## Comandi

```
npm run dev        # sviluppo
npm run build      # build di produzione
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest (logica di valutazione)
```

## Configurazione

`.env.local` (vedi `.env.example`):

- `ANTHROPIC_API_KEY` — senza, l'interfaccia funziona ma le API di analisi rispondono 503.
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` — senza, l'analisi funziona e
  l'inventario si disattiva da solo dichiarandolo, invece di rompersi.

Sul progetto Supabase servono gli accessi anonimi attivi, il bucket privato `item-photos` e un
SMTP configurato perche' la conferma email funzioni oltre le poche unita' l'ora del mailer interno.
