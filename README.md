# STYMA

> "Ho trovato questo oggetto. Conviene comprarlo, e quanto vale davvero?"

Fotografi un oggetto a un mercatino, e in un minuto sai cos'e', quanto vale sul mercato
dell'usato e fino a che prezzo ha senso pagarlo.

## Come funziona

1. **Identificazione** — le foto vanno a un modello vision che riconosce l'oggetto, legge
   punzoni ed etichette e restituisce una scheda strutturata. Non stima prezzi.
2. **Ricerca di mercato** — un secondo passaggio cerca vendite comparabili reali sul web e le
   riporta con fonte, URL, prezzo e se si tratta di una vendita conclusa o di un prezzo richiesto.
3. **Valutazione** — il codice, non il modello, calcola la forbice di prezzo pesando ogni
   comparabile per somiglianza, tipo di prezzo, eta' del dato e stato di conservazione.
4. **Decisione** — il flip score combina margine atteso, affidabilita' della stima e liquidita',
   e restituisce BUY / MAYBE / PASS con le soglie di prezzo corrispondenti.

Quando i dati non bastano, l'applicazione lo dichiara invece di produrre un numero plausibile.

## Avvio

```bash
cp .env.example .env.local   # e inserisci ANTHROPIC_API_KEY
npm install
npm run dev
```

Apri http://localhost:3000 e vai su **Analizza un oggetto**.

## Persistenza

Supabase conserva gli oggetti salvati, le foto e ogni valutazione ricevuta. Le valutazioni non
vengono sovrascritte: rianalizzare un oggetto ne aggiunge una nuova, cosi' resta leggibile come il
mercato si e' mosso.

L'identita' e' una sessione anonima creata al primo salvataggio — in mercatino nessuno si registra —
e la Row Level Security isola i dati per utente. Le foto stanno in un bucket privato sotto
`<user_id>/<item_id>/`, servite con URL firmati.

Setup del database:

```bash
supabase db push --db-url "postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres"
```

Poi, sul progetto Supabase, due passaggi che non si possono fare da SQL:

1. **Accessi anonimi** → Authentication → Sign In / Providers → *Anonymous sign-ins*.
2. **Bucket delle foto** → Storage → New bucket: nome `item-images`, privato, limite 8 MB,
   MIME `image/jpeg, image/png, image/webp`.

Il bucket va creato dalla Dashboard e non dalle migrazioni: il servizio Storage non registra i
bucket inseriti direttamente in `storage.buckets`, e ogni upload risponderebbe "Bucket not found"
pur essendo la riga presente nella tabella. Le policy di accesso, invece, stanno nelle migrazioni.

## Stato

Upload → identificazione → ricerca comparabili → valutazione → decisione → salvataggio in inventario.

Dettagli di architettura e convenzioni: `AGENTS.md`. Requisiti di prodotto: `PROJECT_PRD.md`.
