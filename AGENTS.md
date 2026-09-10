<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# STYMA

Applicazione per chi compra oggetti usati e vuole sapere, sul posto, se conviene comprarli.
Il PRD di riferimento e' `PROJECT_PRD.md`.

**A che punto siamo:** `ROADMAP.md` — stato dei lavori di STYMA 2.0, aggiornato a ogni passo.
Leggilo prima di iniziare qualcosa: dice cosa e' fatto, cosa viene dopo e quali decisioni
sono ancora aperte.

## Come e' organizzato

- `src/app` — route e API. Le route orchestrano, non contengono logica di business.
- `src/features` — componenti di flusso lato client (`analyze`, `inventory`, `listing`, `auth`).
- `src/components` — primitive UI riusabili.
- `src/schemas` — schemi Zod per l'input esterno (output del modello) e tipi di dominio.
- `src/services/ai` — integrazione col modello, isolata dietro `ObjectIntelligenceProvider`.
  La ricerca di mercato gira su corsie parallele con mandati disgiunti (`config.ts`) e i
  risultati vengono ricomposti da `merge.ts`.
- `src/services/valuation` — fascia di prezzo e flip score. Codice puro, testato.
- `src/services/inventory` — lettura e scrittura degli oggetti salvati.
- `src/services/market-cache` — riuso delle ricerche di mercato per modello, con scadenza
  per ritmo di mercato. `policy.ts` e' puro e testato.
- `src/services/market-data` — fonti strutturate: eBay Browse API per le inserzioni con prezzo,
  Discogs per il catalogo musicale. Vengono prima della ricerca col modello, che parte solo se
  questi non bastano.
- `src/services/listing` — prezzo suggerito per un annuncio (`price.ts`, puro e testato). Il testo
  lo scrive il modello via `ObjectIntelligenceProvider.generateListing`, il prezzo mai: viene
  sempre dalla valutazione gia' salvata.
- `src/lib` — utilita' (upload, immagini, formattazione, rate limit) e client Supabase.
- `supabase/migrations` — schema e policy RLS.

## Regole che valgono per tutto il progetto

- **Il modello non decide il prezzo.** Identifica l'oggetto e trova comparabili; la valutazione
  e' aritmetica su quei dati, in `src/services/valuation`. Se i comparabili non ci sono, il
  prodotto dice che non lo sa: non si inventa mai un numero per riempire la UI. Vale anche per
  gli annunci: `generateListing` scrive testo da fatti gia' verificati, mai un prezzo — quello
  arriva sempre da `services/listing/price.ts`, dalla valutazione salvata.
- **Il modello non afferma cio' che non ha verificato.** Un test reale sulla generazione di
  annunci ha prodotto "i meccanismi funzionano, la tastiera risponde bene" senza che nessuno
  l'avesse mai controllato: un'invenzione uguale a un colore sbagliato, solo piu' facile da
  scrivere senza accorgersene. Il prompt lo vieta esplicitamente ora; se si aggiungono altri
  compiti di scrittura, va verificato di nuovo con un test vero, non solo letto sulla carta.
- **Sull'autenticita' non si emette un verdetto, si mostra l'evidenza.** Da una fotografia non si
  stabilisce se un pezzo e' vero, e il danno peggiore che questo prodotto sa fare e' dare a chi sta
  per pagare una sicurezza che nessuno ha guadagnato. `authenticity` porta quattro cose: quanta
  evidenza c'e' (`level`), cosa la sostiene, cosa non torna, cosa guardare. Nessuna dice
  «autentico» — vietato nel prompt anche come aggettivo di un dettaglio. Un `concerns` vuoto vuol
  dire «non ho notato niente», non «e' vero». E il livello ha un tetto aritmetico in
  `services/ai/grounding.ts`: senza nemmeno un marchio letto, «elementi verificabili» non e' una
  risposta possibile, qualunque cosa il modello abbia scritto. Un divieto nel prompt e' una
  speranza; il tetto e' la garanzia. La barra a quattro tacche non si riempie mai del tutto: piena
  si leggerebbe come «certo», e la certezza qui non e' fra le risposte disponibili.
- **Tutto cio' che arriva dal modello passa da uno schema Zod** prima di entrare nell'applicazione.
- **Niente SDK inizializzati a livello di modulo**: `next build` valuta le route senza variabili
  d'ambiente e fallirebbe. Vedi `src/services/ai/anthropic/client.ts`.
- **I numeri della valutazione stanno in `src/services/valuation/config.ts`**, non sparsi nel codice.
- **Ogni tabella ha RLS attiva** e la proprieta' si verifica risalendo a `items.user_id`, mai
  duplicando `user_id` sulle tabelle figlie: due fonti di verita' divergono.
- **Le valutazioni sono immutabili.** Una nuova analisi inserisce una riga, non aggiorna la vecchia.
- **Ogni analisi si salva da sola e ha un indirizzo.** Il pulsante «Salva» buttava minuti di attesa
  e qualche centesimo a ogni tocco sbagliato, e teneva solo cio' che valeva la pena tenere — cioe'
  proprio la meta' del magazzino che non insegna niente. `valuations.snapshot` conserva l'analisi
  come e' stata mostrata, **senza il verdetto**: quello e' funzione del prezzo che stai digitando
  ora, e si ricalcola con `assessFlip`. Chi ricarica la pagina rivede la stessa pagina.
  Corollario: non esiste un pulsante per cancellare, solo `archived_at`. Un oggetto scartato e' il
  dato piu' difficile da raccogliere che questo prodotto abbia.
- **Il prezzo del banco non e' un acquisto.** Il numero digitato per ottenere il verdetto e' quanto
  *chiedono* (`asking_price`): finiva in `purchase_price` con lo stato "comprato" dedotto dalla sua
  presenza, e l'inventario dichiarava acquisti mai fatti sommandoli fra le spese. Quanto hai pagato,
  se hai comprato, quando l'hai venduto e a quanto lo dici tu dopo — `recordOutcome`. Vale anche per
  cio' che non compri: `passed` e' uno stato, ed e' l'unico dato che puo' dire se un «lascia stare»
  era giusto. Un magazzino che registra solo i «si'» non smentisce mai il prodotto.
- **Le corsie di ricerca vanno deduplicate.** Piu' corsie possono trovare la stessa pagina: contarla
  due volte gonfia il campione e quindi la confidenza. La deduplica per URL normalizzato sta in
  `src/services/ai/merge.ts` ed e' testata.
- **La soglia sui comparabili sceglie, non rifiuta.** Se nessun comparabile la supera ma qualcuno
  c'e' — tipico degli oggetti senza marca ne' modello, dove tutto vale `similar_category` — si usano
  quelli, dichiarando che la fascia esce da annunci di categoria e tenendo la confidenza al minimo
  (`weakEvidenceConfidenceCap`). Diciannove annunci reali buttati per lasciare "non lo so" e' il
  comportamento sbagliato.
- **Un "non lo so" non e' mai secco.** Quando non basta per una fascia, `valuation.observed` porta
  comunque quanti annunci si sono visti e fra che prezzi. Chi e' davanti a un banco deve poter
  guardare i dati grezzi invece di restare a mani vuote.
- **Un errore deve dire cosa e' successo davvero.** Una registrazione mancante rispondeva "il
  servizio di analisi non risponde", mandando a cercare un guasto inesistente: ha un codice suo
  (`fixture_missing`) e il messaggio del provider arriva intatto. Ogni `ProviderError` lascia una
  riga di log: un 503 muto e' un vicolo cieco.
- **Sviluppare non deve costare.** `STYMA_AI_FIXTURES=1` rigioca le risposte registrate in
  `bench/fixtures` senza chiamare il modello; `STYMA_AI_RECORD=1` ne registra di nuove pagando una
  volta. Entrambe rifiutano di partire in produzione: servire un'analisi registrata come fresca
  sarebbe la peggiore bugia possibile, visto che qui il numero *e'* il prodotto.
- **Il costo di ogni analisi si misura**, non si stima a occhio: `src/services/ai/usage.ts` conta
  token, ricerche e dollari, e li scrive nei log del server. Il listino sta in `config.ts`.
  Riferimento misurato: **~0,015 $ per analisi completa** (identificazione su Sonnet + eBay).
- **Un modello si misura contro lo schema vero, non contro un banco di prova piu' facile.**
  L'identificazione girava su Haiku, scelto 5/5 contro Opus con `bench/compare-models.mjs` — che
  chiede quattro campi. Lo schema dell'applicazione ne chiede venti, e li' Haiku ha letto il
  modello giusto 2 volte su 9, rispondendo «Lettera 32» a una Olivetti che ha «valentine» scritto
  in rilievo sul frontale, e una volta inventando la marca «Valentino». Sonnet, stesso schema e
  stessa foto: 3 su 3. Dal 2026-09-10 l'identificazione gira su Sonnet, al triplo del prezzo. La
  ragione non e' la qualita' in astratto: se marca e modello sono sbagliati le query eBay cercano
  un altro oggetto, e la fascia che esce e' il prezzo di quell'altro oggetto. **Un'identificazione
  sbagliata non degrada la stima, la sostituisce senza dirlo** — e' l'unico errore di questo
  prodotto che non ha modo di dichiararsi. Ogni campo aggiunto allo schema va pagato con una
  rimisura, perche' il costo di un campo non e' il suo token: e' l'attenzione che toglie ai due
  campi da cui dipende tutto il resto.
- **Non esiste una fonte *lecita* di vendite concluse, quindi non fingiamo di stimarle.** Deciso
  il 2026-09-09, riverificato il 2026-09-10 sul mercato dei dati: la parola non era «gratuita», era
  «lecita». Marketplace Insights di eBay e' Limited Release e chiusa ai nuovi utenti (respinge i
  piccoli), la Finding API e' stata dismessa il 4 febbraio 2025, Terapeak e' solo interfaccia,
  LiveAuctioneers/Invaluable/Barnebys espongono API *in entrata* per le case d'asta e nessuna per i
  prezzi, WorthPoint e' un abbonamento consumer senza API, Discogs vuole un account venditore. Ogni
  fonte che restituisce davvero un prezzo di vendita e' uno scraper — e dal 22 luglio 2026 anche il
  filtro «venduti» del sito eBay e' dietro login. La stima si basa sempre su prezzi richiesti:
  niente sconto sintetico, niente calibrazione. Quello che si puo' fare senza mentire e' portarci
  chi sta al banco: `ebaySoldSearchUrl` apre la ricerca dei venduti sul suo browser.
- **Il livello dei comparabili sostituisce la vecchia distinzione sold/asking.**
  `valuate.ts` sceglie fra tre livelli, in ordine: `identical` (solo lo stesso modello — se bastano
  da soli, gli altri comparabili non entrano, anche se avrebbero superato la soglia di peso da
  soli), `similar` (marca/famiglia/categoria vicina, dichiarato, tetto di confidenza a "medium"),
  `weak` (solo categoria, ultima spiaggia prima di "non lo so", tetto a "low"). Solo `identical`
  puo' arrivare a "high": e' l'unico caso in cui non resta un'incertezza sovrapposta fra "quanto
  vale l'oggetto" e "e' davvero lo stesso oggetto".
- **Il guadagno si misura su quello che spendi, non sul prezzo di vendita.** Sembrano equivalenti e
  non lo sono: la spedizione costa 9 € tanto su un oggetto da 45 € quanto su uno da 550, e si toglie
  prima. Prendendo una quota del venduto (era il 25%), la stessa riga di configurazione pretendeva
  un ritorno del 163% per dire «compralo» sotto i 50 € e del 95% sopra i 500 — e i mercatini stanno
  tutti in fondo a quella scala. `dealRoi` e' sul capitale speso: la richiesta e' la stessa a ogni
  livello di prezzo.
- **Due numeri che sembrano contraddirsi vanno collegati in pagina, non in un accordion.** «Vale
  30–70 €» accanto a «paga fino a 15 €» si legge come un errore, e la spiegazione — quei 70 non li
  incassi — stava chiusa. Ogni volta che la pagina mostra due cifre che un lettore ragionevole
  leggerebbe come incoerenti, il ponte fra le due e' contenuto obbligatorio, non approfondimento.
- **Il prezzo massimo di acquisto e' una sottrazione, non una bisezione.** Nasceva cercando il
  prezzo a cui il flip score toccava settanta: coerente, ma impossibile da verificare per chi lo
  legge, e qui il numero *e'* il prodotto. Ora e' `valore atteso − commissioni − spedizione −
  cuscinetto di rischio − margine obiettivo`, in `priceThresholds`, e ogni riga viaggia nel
  risultato (`thresholds.breakdown`) per poter essere mostrata. Il cuscinetto e' la sola riga che
  dipende dalla confidenza: una stima fragile abbassa il prezzo massimo invece di scaricare il
  rischio su chi compra.
- **Il verdetto e' la fascia in cui cade il prezzo, non una seconda lettura del punteggio.**
  Finche' usciva dal flip score poteva contraddire il prezzo massimo stampato due righe sotto —
  COMPRALO sopra una cifra superiore al massimo consigliato. `recommendationAt` legge le soglie,
  e un test percorre tutti i prezzi da 0 a 120 per verificare che le due cose non divergano mai.
  Il punteggio resta, e risponde a un'altra domanda: non «quanto pagarlo» ma «quanto e' buona
  questa occasione».
- **Un peso su un dato che non abbiamo non e' neutro, e' un regalo.** La liquidita' pesava un
  quarto del punteggio ma vale sempre `unknown` (0,5) senza ricerca agentica: dodici punti e mezzo
  identici per ogni oggetto, che schiacciavano tutti i punteggi fra 12 e 87 e diluivano i due
  fattori che discriminano. Ora `effectiveWeights` lo ridistribuisce fra margine e confidenza,
  nella proporzione che avevano gia', e lo restituisce alla liquidita' appena domanda o liquidita'
  vengono osservate davvero — cosi' accendere la ricerca agentica funzionerebbe senza altre
  modifiche. Il fatto che non siano osservate compare fra i fattori del punteggio.
- **La ricerca agentica e' spenta per scelta** (`research.agenticFallback`). Misurato: ~0,96 $ per
  tre corsie contro i 4 centesimi di un'analisi che si ferma a eBay. Accenderla e' una decisione
  economica, da prendere con un numero davanti — non un default.
- **eBay si interroga su cinque mercati** (IT, DE, GB, ES, FR): l'API non si paga a chiamata, quindi
  allargare il campione non costa. Misurato: 93 inserzioni contro 56 su un oggetto reale, passando
  da tre a cinque mercati.
- **Le fonti si interrogano in ordine di costo crescente:** fonti strutturate (gratis e fresche) →
  cache (evita di ripagare il modello) → ricerca col modello (~1,30 $ e minuti, ultima risorsa).
  Le inserzioni eBay non si archiviano in cache: sono gratis, e conservarle vorrebbe dire servire
  domani un annuncio scaduto al posto di uno vivo.
- **Il nome del modello va accorciato prima di usarlo** (`src/lib/model-name.ts`). "AE-1 con FD 50mm
  f/1.8" e "AE-1" sono lo stesso oggetto: come chiave di cache fanno due voci, come query di
  ricerca fanno passare da 11.455 inserzioni a una.
- **Discogs misura la concorrenza, non la domanda.** `num_for_sale` dice quante copie sono in
  vendita, cioe' quante alternative ha chi compra. Dedurne la domanda sarebbe un'invenzione:
  `demand` e `liquidity` restano `unknown` finche' nessuno ha guardato i venduti. E `lowest_price`
  e' un pavimento, non una media: non entra fra i comparabili, si dichiara come pavimento.
- **Tre tipi di prezzo, non due.** La Browse API restituisce annunci in corso: `sold` non esiste,
  e spacciarli per vendite concluse sarebbe la bugia piu' facile da fare qui. Ma non sono nemmeno
  tutti `asking`. Un'asta con almeno un'offerta porta una cifra di natura diversa — soldi che
  qualcuno ha davvero impegnato — ed e' `bid`. Un'asta senza offerte resta `asking`: la base d'asta
  e' quanto chiede il venditore.
- **Un'offerta in corso e' un pavimento, non un prezzo, e non entra nella stima.** Misurato su 446
  aste reali con offerte, otto oggetti e cinque mercati: l'offerta corrente sta fra il **12% e il
  71%** della mediana dei prezzi fissi dello stesso oggetto, e la distanza non si chiude nemmeno
  nelle ultime due ore prima della chiusura. Non c'e' un fattore di correzione da applicare —
  applicarne uno sarebbe lo sconto sintetico gia' escluso per le vendite concluse. Quello che
  l'offerta dice per certo e' che almeno una persona ha impegnato quella cifra: si mostra come
  pavimento, esattamente come `lowest_price` di Discogs. `bench/auction-bids.mjs` rifa' la misura.
- **Le aste vanno chieste a parte.** Con `buyingOptions:{FIXED_PRICE|AUCTION}` eBay mette il prezzo
  fisso davanti: su "canon ae-1" tornano 24 aste su 250 risultati. Chiedendo solo aste ne tornano
  213. Un giro dedicato, con la query migliore, e si tengono le cinque offerte piu' alte — servono
  a dire fin dove qualcuno si e' spinto, non a fare una media.
- **`price` e' opzionale sulle inserzioni eBay.** Diciotto aste su venti non ce l'hanno: portano
  solo `currentBidPrice`. Lo schema lo pretendeva, quindi `safeParse` falliva e l'inserzione
  spariva senza una riga di log — le aste non sono mai entrate nel campione, mentre il commento nel
  codice diceva il contrario. Uno schema severo su un campo facoltativo non protegge: nasconde.
- **Un accessorio porta marca e modello nel titolo, quindi entra dalla porta principale.** «Cinghie
  per custodia Olivetti Valentine — Set da 2» a 55 € era il comparabile *piu' pesante* nella stima
  di una macchina da 240 €: `inferMatchLevel` legge il titolo e lo classifica `exact_model`, che e'
  il livello col peso massimo e senza filtri sopra, e lo scarto dei prezzi fuori scala non lo
  prende perche' 55 su 240 non e' cinque volte sotto il mediano. `looksLikeAccessory` guarda **dove**
  sta la parola, non se c'e': la marca segna il confine fra cosa si vende e cosa viene insieme.
  Un elenco applicato ovunque — la prima versione — scartava trenta inserzioni su cento e la
  maggioranza erano l'oggetto vero («Typewriter **with Case**», «**manual** camera»). Ogni parola
  di quell'elenco e' stata tolta o tenuta guardando `bench/accessories.mjs` su inserzioni vere,
  mai a ragionamento: fra i due errori possibili, togliere comparabili buoni e' il peggiore,
  perche' alza la stima e ti fa pagare di piu'.
- **`similar_category` non e' un livello di somiglianza qualunque: e' il caso in cui non c'e'
  nessuna prova.** Senza marca ne' modello da confermare, un errore di corrispondenza di eBay (una
  ricerca di "borsa" che risponde con un trolley) entrerebbe come comparabile valido quanto uno
  vero. `isRelevantTitle` in `market-data/ebay/mapping.ts` richiede almeno una parola vera in
  comune con la query prima di accettarlo; scatta solo a `similar_category`, perche' altrove marca
  o modello sono gia' una prova migliore del testo libero.
- **La marca da sola non fa un comparabile: serve anche il tipo di oggetto.** Segnalato dal vivo su
  una polo Fred Perry — senza cartellino leggibile il modello e' `null`, la ricerca era
  `marca + category`, e `category` ("abbigliamento") non toglie un solo maglione. Maglioni e
  cappotti della stessa marca finivano nella stima della polo con lo stesso peso di un'altra polo.
  `objectType` in `schemas/identification.ts` e' la parola che un venditore mette nel titolo
  ("polo", "vaso", "lampada da tavolo"): entra nella query al posto della categoria, e
  `mentionsObjectType` lo pretende nel titolo quando il livello e' `same_brand`, l'unico in cui la
  marca e' l'unica prova. Basta una parola in comune — "lampada da terra" resta un comparabile di
  "lampada da tavolo", un maglione contro una polo no.
- **Una ricerca riusata si dichiara.** La cache riusa i comparabili di un modello gia' cercato
  (30 giorni per il modernariato, 14 per il medio, 7 per l'elettronica, che si deprezza a gradini).
  L'interfaccia dice sempre quanti giorni ha la ricerca: un dato riusato che sembra fresco e'
  esattamente la bugia che questo prodotto non puo' dire.
- **La cache non si scrive dai client.** `market_research_cache` ha RLS attiva e zero policy: ci
  arriva solo il server con `SUPABASE_SERVICE_ROLE_KEY`. Una cache condivisa scrivibile dal browser
  si avvelena, e comparabili inventati sposterebbero le valutazioni di tutti.
- **Le cuciture si provano in un browser vero.** `npm run e2e` percorre foto → analisi →
  indirizzo → comprato → venduto → archiviato, con Chrome e Supabase veri (l'identificazione si
  rigioca dalle risposte registrate, eBay no). Non e' ridondante coi test unitari: quelli coprono
  l'aritmetica, questo copre i punti di giunzione — la sessione anonima che nasce al primo
  salvataggio, l'indirizzo che cambia senza navigare, lo snapshot riletto da un altro processo,
  un'azione server chiamata da un bottone. Al primo colpo ha trovato due bug che typecheck, lint,
  build e 170 test unitari avevano lasciato passare. Il test cancella l'oggetto che crea: se lo si
  interrompe a meta', resta in inventario.
- **Un guardiano sulla «prima esecuzione» di un effetto non regge.** In sviluppo React monta ogni
  effetto due volte: il primo giro consuma il guardiano e il secondo fa il lavoro che doveva
  saltare. Era cosi' che il salvataggio del prezzo digitato scriveva `null` sopra il valore appena
  registrato. La forma giusta e' confrontare col valore gia' scritto (`useAskingPrice.ts`): un
  effetto idempotente si puo' rimontare quante volte si vuole.
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
npm run e2e        # playwright: il giro completo in un browser vero (~30s)
npm run schermate  # istantanee della pagina risultato su schermo da telefono

node bench/research-bench.mjs [foto.jpg]   # cronometra e conta i costi di un'analisi contro `npm run dev`
node bench/why-no-value.mjs foto.jpg ...   # segue l'imbuto quando non esce una stima
node bench/compare-models.mjs foto.jpg ... # confronta i modelli sull'identificazione (si paga)
node bench/auction-bids.mjs "query" ...     # quanto valgono le offerte d'asta contro i prezzi fissi
node bench/accessories.mjs                 # quanti comparabili sono accessori, e cosa toglie il filtro
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
