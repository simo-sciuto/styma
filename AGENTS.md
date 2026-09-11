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
- `src/services/inventory` — lettura e scrittura degli oggetti salvati. `ledger.ts` e' il conto
  economico del magazzino, puro e testato, che alimenta `/andamento`.
- `src/services/market-cache` — riuso delle ricerche di mercato per modello, con scadenza
  per ritmo di mercato. `policy.ts` e' puro e testato.
- `src/services/market-data` — fonti strutturate: eBay Browse API per le inserzioni con prezzo,
  Discogs per il catalogo musicale. Vengono prima della ricerca col modello, che parte solo se
  questi non bastano.
- `src/services/listings` — da un link a un annuncio leggibile (Vinted, eBay). `parse.ts` e' puro
  e testato, e la sua lista di domini e' un controllo di sicurezza.
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
  Riferimento **rimisurato il 2026-09-11**: **0,042 $ con una foto sola**, e circa **0,10 $ con
  otto** — ogni foto da 1600px vale ~2.560 token in ingresso, e l'ingresso e' la voce che cresce.
  La cifra che stava qui prima, 0,015 $, era quella dell'identificazione su Haiku e non e' mai
  stata aggiornata quando siamo passati a Sonnet: e' esattamente il numero invecchiato da solo
  contro cui questo file mette in guardia due righe piu' sotto. Rimisurare fa parte del cambio di
  modello, non e' un lavoro separato.
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
- **Il guadagno si misura su quello che spendi, non sul prezzo di vendita.** Prendendo una quota
  del venduto (era il 25%), la stessa riga di configurazione pretendeva un ritorno del 163% per
  dire «compralo» sotto i 50 € e del 95% sopra i 500, e i mercatini stanno tutti in fondo a quella
  scala. `dealRoi` e' sul capitale speso: la richiesta e' la stessa a ogni livello di prezzo.
- **Spedizione e commissioni non entrano nei conti.** C'erano 9 € fissi di spedizione e il 10% di
  commissioni marketplace sottratti a ogni stima. Su un oggetto da 15 € la sola spedizione faceva il
  60% del valore, e insieme bastavano a far sparire il prezzo massimo di quasi tutto quello che si
  trova a un mercatino. Chi usa STYMA vende soprattutto di persona: un costo che non paghi non puo'
  entrare in una sottrazione ne' diventare un avviso, e sono usciti tutti e due. Il conto e' ora
  `valore atteso − margine = prezzo massimo`, tre righe.
  **Il rovescio, da sapere:** chi vende su Vinted o eBay lascia davvero una quota sul venduto, e per
  lui il prezzo massimo che mostriamo e' alto di circa un decimo. Se un giorno tornano, tornano come
  scelta di chi vende, non come costante per tutti.
- **Un conto si semplifica sommando le righe, non cancellandole.** «Margine di sicurezza» e
  «il tuo guadagno» erano due righe vere e una di troppo: sommate fanno «il tuo margine», e la
  colonna torna fino all'ultimo centesimo. Cancellare il cuscinetto avrebbe dato lo stesso prezzo
  massimo a una stima solida e a una tirata fuori da tre annunci, perche' e' la sola parte del conto
  che dipende da quanto siamo sicuri. Ogni volta che una riga va tolta dalla vista, la domanda e' se
  si puo' sommare a un'altra: se non si puo', il numero in fondo smette di essere verificabile.
- **Chi compila un dato deve guadagnarci qualcosa.** «Vale la pena segnarlo anche se l'hai lasciato
  li': e' l'unico modo di sapere se questa app ci aveva visto giusto» era vero e inutile, perche'
  nessuno preme un bottone per fare un favore a un'app. Le stesse due risposte servono a chi le da':
  quello che compri entra nel conto di quanto stai guadagnando, quello che lasci resta come una
  scommessa da riaprire. Che di riflesso ci dicano se le nostre stime reggono e' un effetto
  collaterale, e come tale non si scrive in pagina.
- **Un blocco chiuso dichiara cosa contiene.** Quattro accordion in fila con un titolo generico
  ciascuno non danno a nessuno un motivo per aprirne uno invece di un altro, quindi non se ne apre
  nessuno. `Disclosure` porta un `hint`: «3 marchi letti sull'oggetto» e «2 cose non tornano» sono
  due inviti diversi, e il secondo va aperto subito.
- **L'attesa dell'analisi prende tutto lo schermo.** Per un minuto e mezzo non c'e' nient'altro da
  fare e l'unica cosa che si vuole sapere e' se sta ancora lavorando: tutto quello che circondava il
  blocco dei passi era rumore intorno all'unica cosa viva. La foto dell'oggetto sta in cima, perche'
  e' la conferma piu' diretta che stiamo guardando il tuo.
- **Le etichette dicono cosa fanno, e basta.** Sotto ogni sezione c'era un paragrafo che spiegava
  perche' quella sezione esiste: veri, scritti bene, e lunghi il doppio del contenuto che
  commentavano. Chi legge sta in piedi davanti a un banco. Poche parole dirette, e niente trattini
  lunghi in nessun testo visibile: in una riga stretta su un telefono un inciso fra trattini si
  legge come una frase spezzata.
- **Il primo numero della pagina e' quanto vale.** Il blocco della decisione si apriva chiedendo
  «quanto costa», cioe' chiedendo un dato prima di dare una risposta. Ma la domanda con cui uno
  arriva qui e' «quanto vale», e la risposta ce l'abbiamo prima che digiti qualsiasi cosa: la
  fascia sta in cima, il campo del prezzo e il verdetto vengono dopo.
- **Un fattore che c'e' su ogni oggetto non e' un fattore.** Fra i motivi del punteggio comparivano
  sempre «domanda e tempi di vendita non osservati» e «commissioni stimate: N €»: veri entrambi, e
  presenti su ogni singola analisi. Un elenco che comincia con due righe uguali per tutti insegna a
  saltarlo. La ridistribuzione dei pesi resta, e resta testata: e' l'aritmetica a doverne tenere
  conto, non un'etichetta.
- **I numeri della home escono dal motore, non da un elenco scritto a mano.** C'era un blocco di
  cifre sul funzionamento — quanti mercati eBay, quanto costa un'analisi, quanti livelli di
  comparabili — e una era diventata falsa da sola: «0,006 € per analisi» era il costo con
  l'identificazione su Haiku, e da settembre giriamo su Sonnet a piu' del doppio. Nessuno se n'era
  accorto perche' niente la ricalcolava. Al suo posto c'e' un esempio che passa da
  `priceThresholds` e `recommendationAt`, le stesse funzioni che rispondono davanti al banco, e usa
  gli stessi componenti della pagina risultato: se cambia l'aritmetica, cambia anche la home. Un
  numero in vetrina che invecchia senza che nessuno lo tocchi e' il modo piu' silenzioso di mentire.
- **Le etichette usano le parole che diresti a voce.** «Quanto te lo chiedono» era gergo da
  mercatino: limpido per chi ci sta dentro, opaco per tutti gli altri. «Quanto costa» e' la domanda
  che fai al venditore. Stessa ragione per «attribuzione» → «quanto e' sicuro che sia questo», e per
  «annunci usati», che voleva dire «usati per la stima» e si leggeva «annunci di roba usata» — che
  qui sono tutti.
- **Quattro regole sul testo visibile, e servono a tenere a bada un tic che ricresce da solo.**
  Contate prima della revisione: ventuno costruzioni «X, non Y» e sei frasi sopra i novanta
  caratteri, su un'app che si usa in piedi con una mano sola.
  1. **Una frase, un punto.** Il due punti che introduce una giustificazione va quasi sempre
     sostituito da un punto fermo. «Niente da segnalare. Quello che una foto non vede, guardalo tu»
     al posto di «Niente da segnalare: resta quello che una foto non vede, controlla di persona».
  2. **«X, non Y» si usa una volta.** E' la forma con cui questo prodotto dice la verita' scomoda —
     «prezzi richiesti, non vendite concluse» — e proprio per questo va spesa dove conta. Ripetuta
     dieci volte diventa un tono querulo e smette di segnalare niente.
  3. **Un'etichetta non spiega se stessa.** «Quanto e' buona l'occasione · 92/100» si capisce;
     «non e' quanto vale l'oggetto ne' quanto pagarlo, e' quanto conviene questo affare rispetto a
     un altro a parita' di soldi che hai in tasca» e' una difesa preventiva contro un'obiezione che
     nessuno ha ancora fatto.
  4. **Il prodotto non parla di se'.** «E' il solo numero che non descrive il mercato: descrive te»
     e' una cosa vera che sta bene in un commento nel codice e non sullo schermo di chi sta
     trattando un prezzo. Le ragioni di una scelta si scrivono qui e in AGENTS.md, non in pagina.
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
  corsia quando finisce davvero. Nessuna barra di avanzamento che si muove da sola: dove non
  sappiamo quanto manca, la barra e' indeterminata e va avanti e indietro, che e' piu' onesto di una
  che si ferma al novanta per cento.
- **L'attesa ha una lingua sola**, non una per punto: scheletro a forma del contenuto per le pagine
  (`components/Skeleton.tsx` + `loading.tsx`), punto che pulsa per le attese brevi (`pending` su
  `Button` e `TextButton`), blocco a passi per l'analisi (`AnalysisProgress`). I passi si accendono
  sugli eventi veri dello stream, non su un timer: se la pipeline cambia vanno cambiati con lei.
  Ogni indicatore parte con 120 ms di ritardo — un'azione che dura un battito non deve produrre un
  lampo — e occupa spazio anche da spento, perche' un puntino che appare non deve spostare
  l'etichetta sotto il dito.
- **Una pagina ha tre livelli, non undici blocchi pari.** La pagina risultato
  aveva undici schede con lo stesso bordo, lo stesso fondo e lo stesso raggio:
  il conto del flip pesava quanto «Cos'e', in breve», e chi legge doveva
  decidere da solo cosa guardare — cioe' fare il lavoro che il prodotto esiste
  per fare. `Card` prende un livello: **1** bordo spesso, ombra piena e colore
  (la risposta), **2** bordo spesso e fondo chiaro (le prove), **3** nessuna
  scatola, solo un filo (il resto). Il tratto e l'ombra non sono uno stile:
  sono l'unico linguaggio in cui tre livelli si distinguono da lontano e
  sfocati, che e' la condizione d'uso vera — un telefono, in mano, al sole,
  col venditore che aspetta. L'ombra e' netta e senza sfocatura apposta: una
  sfumata darebbe tre livelli distinguibili solo da vicino, cioe' nessuno.
- **Un conto stampato due volte non e' trasparenza, e' un invito a non
  fidarsi.** La pagina mostrava la sottrazione che porta al prezzo massimo e,
  venti righe sotto, quella che porta al guadagno — stessa forma tipografica,
  due domande diverse, e chi legge conclude che una delle due sbaglia.
  Guardandole vicine si vede che le prime tre righe sono identiche: da
  `valore atteso − commissioni − spedizione` in poi cambia solo cosa sottrai.
  `Ledger` scrive il tronco una volta e ne fa uscire i due rami. Ogni volta
  che due blocchi mostrano la stessa aritmetica con un termine diverso, e'
  un blocco solo che non e' stato ancora scritto come tale.
- **L'indirizzo di una pagina non cambia rotta con `replaceState`.** Il
  risultato dell'analisi si riscriveva l'indirizzo in `/inventario/<id>`,
  con un commento che spiegava che non era una navigazione. In App Router lo
  e': `pushState` e `replaceState` sono agganciati al router
  (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`),
  e da quel momento il router crede di stare li'. Alla prima azione server
  successiva — il primo carattere digitato nel prezzo — rigenerava *quella*
  rotta: il risultato spariva dietro uno scheletro e il prezzo appena scritto
  si perdeva nella corsa col salvataggio ritardato. Il bug e' rimasto
  invisibile per settimane perche' non scattava subito. Si riscrivono solo i
  **parametri di ricerca**, restando sulla stessa rotta: l'analisi vive a
  `/analizza?oggetto=<id>`, e la scheda dell'oggetto si raggiunge con un
  collegamento vero.
- **Un numero che non varia mai non va mostrato.** Accanto a ogni comparabile
  c'era «peso 1.00», su tutte le righe: sembrava una discriminazione e non ne
  faceva nessuna. La ragione e' misurata — eBay dichiara la condizione su
  **3 inserzioni su 20**, quindi uno dei due fattori del peso e' una costante
  sulle altre 17 — e la cura e' mostrarlo solo quando cambia *dentro l'elenco
  che si sta guardando*, non nell'insieme: le quattro righe aperte possono
  valere tutte uguale mentre fra i settantaquattro piegati il peso varia.
  Una colonna di numeri identici insegna a saltare la riga in cui sta, e la
  lezione vale anche la volta in cui quel numero conta.
- **Un comparabile si controlla con gli occhi, quindi porta la sua foto.** La
  Browse API la restituisce su 20 inserzioni su 20 — misurato in produzione,
  insieme a `itemLocation` e `shippingOptions` — e la buttavamo via, lasciando
  quattro righe di titolo eBay scritto per un motore di ricerca. Distinguere
  «questo e' il mio oggetto» da «questa e' un'altra cosa» e' l'unico controllo
  sui comparabili che il nostro codice non sa fare, e senza immagine non lo
  puo' fare nemmeno chi legge. `imageUrl` resta pero' fuori dallo schema che
  vede il modello (`ModelMarketResearchSchema`): un campo in piu' li' non
  costa token, costa attenzione tolta a marca e modello.
- **Due utility di display sullo stesso elemento non si combinano.** `inline-block hidden` non
  nasconde niente: vince quella che nel CSS generato di Tailwind viene dopo, non quella scritta per
  ultima nella classe. Il punto d'attesa e' rimasto acceso su ogni bottone finche' una schermata non
  l'ha mostrato — typecheck, lint e test non hanno niente da dire. Per accendere e spegnere si usa
  la visibilita' (`visible`/`invisible`), che non litiga con niente.
- **Il cruscotto conta soldi veri, mai stime.** `/andamento` risponde a «sto guadagnando?», e per
  farlo non puo' mescolare quello che e' successo con quello che si spera: le stime restano
  nell'inventario e sono previsioni, qui entrano solo prezzi pagati e prezzi incassati. Le spese
  vanno al mese in cui hai pagato e gli incassi al mese in cui hai venduto, perche' e' cosi' che si
  muovono i soldi: attribuire tutto alla vendita farebbe sembrare senza spese proprio il mese in cui
  hai svuotato il portafoglio. Il margine invece appartiene alla vendita, ed e' l'unico modo di
  legarlo all'oggetto giusto. `services/inventory/ledger.ts` e' puro e testato, e usa le stesse
  commissioni di `flipConfig`: se qui uscisse da un'altra aritmetica, due schermate dello stesso
  prodotto direbbero due cose diverse sullo stesso oggetto.
- **Un link vale una fotografia, ma solo dove e' lecito leggerlo.** Da `/analizza` si puo' incollare
  il link di un annuncio invece di fotografare: l'idea nasce da come si usa il telefono davvero,
  cioe' scorrendo Vinted sul divano. Due sorgenti, e la scelta non e' tecnica.
  **eBay** si legge dalla Browse API con le credenziali che gia' usiamo (`get_item_by_legacy_id`):
  dato ufficiale, autorizzato, completo — e la pagina web di eBay risponde 403 a un fetch da
  server, il che dice da solo quale strada e' quella giusta.
  **Vinted** si legge dalla pagina, e lo facciamo perche' lo dicono loro: il `robots.txt` di
  vinted.it lascia `/items/` aperto a `User-Agent: *` e porta
  `Content-Signal: ai-train=no, search=yes, **ai-input=yes**`, dove «ai-input» e' definito nel file
  stesso come dare contenuto in pasto a un modello. Una pagina per volta, su richiesta di chi la
  sta guardando, senza addestrare niente. **Se quel segnale diventa `no`, la funzione si spegne,
  non si aggira.** Tutto il resto resta fuori finche' non c'e' un'API o un segnale altrettanto
  chiaro.
- **Il testo dell'annuncio non entra nel prompt.** L'identificazione gira sulle foto, come sempre.
  Se il venditore scrive «Olivetti Valentine» e le foto mostrano una Lettera 32, quel disaccordo e'
  l'informazione piu' utile della pagina, e mescolando le due cose sparirebbe. `ListingCard` le
  tiene su due colonne: quando dicono la stessa cosa chi legge si fida di piu', quando non la
  dicono lo vede.
- **Il titolo del venditore e' una query, mai un'affermazione.** Su Vinted il nome del modello e' il
  valore, e spesso e' l'unica cosa precisa disponibile quando dalle foto un modello non si legge.
  Metterlo in `model` vorrebbe dire far affermare al prodotto una cosa che non ha verificato; in
  `searchQueries` non afferma niente, e saranno i comparabili a reggere o a non reggere.
  **Tagliato, pero':** misurato su un annuncio vero, il titolo intero da' **zero risultati** su
  cinque mercati, e tagliato dalla marca in poi ne da' tre e centrati. Le parole prima della marca
  sono come chi vende chiama la categoria nella sua lingua, e nei titoli eBay non ci sono. E' la
  stessa regola di posizione di `looksLikeAccessory`: la marca segna il confine.
- **Le foto di un annuncio si copiano, non si linkano.** Un'analisi nata da un link non passa da
  nessun file scelto a mano, e senza `importListingImages` l'oggetto salvato resta **senza foto
  dappertutto**: niente copertina in lista, niente immagine nella scheda. Il difetto non si vede
  subito, perche' il risultato appena fatto mostra le foto dell'annuncio dal vivo; si vede domani,
  con l'inventario pieno di rettangoli grigi. E si copiano perche' un annuncio venduto sparisce
  insieme alle sue immagini: quello che teniamo dev'essere nostro.
- **Vinted serve la stessa pagina in due versioni, e la seconda e' pericolosa.** Misurato sullo
  stesso annuncio a un'ora di distanza: una volta col JSON-LD (prezzo, marca, categoria, e cinque
  foto su sedici prima del marcatore dei consigliati), una volta senza — e li' **quindici foto su
  sedici stanno prima del marcatore**, cioe' il marcatore non separa piu' niente. Prendere le prime
  cinque vorrebbe dire identificare l'oggetto di qualcun altro. Nel ripiego si prende **una foto
  sola**, la prima della galleria, e il prezzo non si indovina: lo scrive chi guarda. Un'analisi su
  una foto e' piu' debole e lo dichiara da sola; una sull'oggetto sbagliato no.
- **Il parsing sta separato dal fetch.** `vinted-parse.ts` non importa `server-only` ed e' testato
  su frammenti scritti a mano: una pagina vera pesa due megabyte e appartiene a Vinted, tenerne una
  copia nel repository sarebbe archiviare contenuto altrui, che e' un'altra cosa rispetto a
  leggerlo una volta su richiesta di chi lo sta guardando.
- **`toBeVisible` non basta su un'immagine.** Un `<img>` con la sorgente rotta e' visibile lo
  stesso, e la prima versione del test sulle foto importate passava mostrando un rettangolo grigio.
  La domanda e' se il pixel c'e': si guarda `naturalWidth`.
- **Un dominio in una lista bianca e' un controllo di sicurezza.** L'URL incollato lo apre il
  *nostro* server. La prima versione del riconoscitore usava `/(^|\.)vinted\.[a-z.]+$/`, e il punto
  dentro la classe rendeva valido `vinted.it.truffa.example`: chiunque poteva farsi aprire una
  pagina qualunque dal nostro backend. Se n'e' accorto un test, non una rilettura.
- **La navigazione del telefono sta in basso, ma il marchio resta in alto.** Le voci erano tre in
  una barra in alto e ci stavano appena; la quarta non ci sarebbe entrata. Ma il vincolo vero non
  era lo spazio: questa app si usa in piedi con una mano sola, e il bordo alto di uno schermo da sei
  pollici e' il punto piu' lontano dal pollice che ci sia. `BottomNav` su telefono, `Header` da `sm`
  in su, e il `<body>` porta `pb-24` sotto quel breakpoint perche' una barra fissa senza spazio
  copre l'ultima riga di ogni pagina.
  **Togliendo del tutto la barra alta era sparita la home**, e dentro l'app non c'era piu' modo di
  uscirne: sul telefono resta una riga col solo marchio, che e' il collegamento a `/`. Quaranta
  pixel sono il prezzo giusto per non avere un vicolo cieco.
- **L'analisi e' un pulsante che sporge, non una voce come le altre.** Finche' l'oggetto arrivava
  solo da una fotografia al banco, «Analizza» poteva stare in fila con «Inventario» e «Andamento».
  Da quando arriva anche da un link ha smesso di essere una delle cose che fa l'app: e' la cosa che
  fa l'app, da un banco o dal divano. Il pulsante sta in mezzo alla barra perche' li' arriva il
  pollice di entrambe le mani, e la home rientra fra le voci per chiudere la simmetria attorno a
  lui. Su schermo grande non c'e' una barra da cui sporgere, e la stessa cosa si dice con un
  pulsante pieno accanto a voci che non lo sono.
- **La voce attiva e' inchiostro, l'azione e' teal.** Erano tutte e due teal piene, e su uno schermo
  grande «+ Analizza» e la pagina in cui ti trovi diventavano due blocchi identici: il colore
  smetteva di dire quale dei due fosse l'azione. Il nero non e' riservato a niente, si distingue dal
  teal a un metro, e a un metro era il motivo per cui la voce attiva un colore ce l'ha.
- **Il cruscotto risponde a due domande, non a una.** «Sto guadagnando» ne ha una sola e sta in
  cima. «Su cosa» cambia cosa comprerai domenica prossima, e la categoria la scrive il modello a
  ogni identificazione — ce l'avevamo da sempre e non la leggeva nessuno. Il margine per categoria
  conta **solo i venduti**: su quello che hai ancora in casa il margine non e' ancora successo, ed
  e' l'errore che rende inutili quasi tutti i cruscotti di magazzino.
- **Il margine cumulato va sopra le barre mensili.** Un mese storto dentro una curva che sale e' un
  mese storto; lo stesso mese dentro una curva che scende e' un problema, e le barre da sole non lo
  distinguono. La curva ha una scala sua — condividere l'asse con le barre le schiaccerebbe a
  niente — e siccome non ha assi, il suo valore finale si scrive nella legenda: senza, si legge la
  forma e non si legge la cifra.
- **Il capitale fermo si divide in tre fasce.** Un solo numero non distingue un magazzino che gira
  da un ripostiglio. Tre si', e la terza (oltre tre mesi) prende il rosso del verdetto: e' quella
  da guardare.
- **I grafici si disegnano a mano, in SVG.** Sono rettangoli su una scala lineare, e una libreria da
  centinaia di kilobyte per disegnarli la pagherebbe chi apre la pagina da un telefono in giro. Due
  cose che sembrano dettagli: con `vectorEffect="non-scaling-stroke"` lo spessore si legge in pixel
  di schermo e non in unita' di viewBox (0,7 spariva), e l'asse dello zero non sta a meta' altezza
  ma dove lo mettono i dati, altrimenti meta' riquadro resta vuoto e le etichette dei mesi finiscono
  lontane dalle barre che nominano.
- **L'attesa lunga e' l'identificazione, non la ricerca.** Misurato: eBay risponde in **2,5
  secondi** su cinque mercati, l'identificazione ne prende **21** con una foto sola. Non e' il
  modello a essere lento: sono millecinquecento token di prosa generati uno dopo l'altro, e la
  maggior parte (storia, controlli fisici, motivi della confidenza) serve alla pagina del
  risultato, non a chi sta aspettando. Qualunque idea di «rispondere prima» che non tocchi quei
  ventun secondi sta ottimizzando il 10% del problema.
- **Quello che si puo' accorciare e' il tempo in cui chi guarda non sa niente.** I campi che
  contano stanno in cima allo schema — `name`, `objectType`, `category`, `brand`, `model` — e sono
  scritti per primi: `/api/identify` risponde a eventi e li manda avanti appena sono chiusi.
  Misurato: **primo dato utile dopo 3,4 secondi invece di 22,9**. L'attesa dura uguale, e non si
  finge il contrario: la barra resta indeterminata e nessun passo si accende per un timer.
  `services/ai/partial.ts` legge solo valori gia' chiusi dalle virgolette — un nome che si completa
  sotto gli occhi sfarfalla, ed e' peggio del vuoto — ed e' puro e testato.
- **Una registrazione non si rigioca a pezzi.** `FixtureProvider` restituisce l'identificazione
  tutta insieme e non manda parziali: spezzettarla con dei timer per simulare il modello che scrive
  mostrerebbe un'attesa inventata al posto di una vera, che e' la cosa piu' vicina a una bugia che
  quel componente sa fare.
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
