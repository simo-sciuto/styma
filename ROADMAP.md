# STYMA 2.0 — stato dei lavori

Da identificatore di oggetti a **motore decisionale per la rivendita**.
La domanda del prodotto non e' piu' «quanto vale» ma «lo compro?».

Piano completo: vedi l'artifact *STYMA Product Evolution Plan*.
Regole che valgono per tutto il codice: `AGENTS.md`.
Specifica originale: `PROJECT_PRD.md`.

**Questo file si aggiorna a ogni passo.** Se una riga qui non corrisponde al
codice, e' questo file a essere sbagliato.

I riferimenti ai commit si scrivono nel passo *successivo*: un commit non puo'
contenere il proprio hash, e scriverlo prima di un amend lo rende subito
falso — gia' successo una volta.

---

## Dove siamo

**Fase E — P0, il motore decisionale: completa.** Tutti e dodici i P0 del brief
sono in pagina.

**Fase F — P1, completa.** Nell'ordine deciso insieme: esito reale →
autenticita' a livelli → URL del risultato.

```
E1 ████████████████████ blocco decisione            fatto
E2 ████████████████████ prove dell'identificazione  fatto
E3 ████████████████████ mercato come prova          fatto
E4 ████████████████████ rischi in una sezione sola   fatto
E5 ████████████████████ economia del flip            fatto
E6 ████████████████████ prima di comprare + guida foto  fatto

F1 ████████████████████ esito reale in inventario   fatto
F2 ████████████████████ autenticita' a livelli      fatto
F3 ████████████████████ URL del risultato           fatto

G1 ████████████████████ aste: il segnale che buttavamo  fatto
G2 ████████████████████ test end-to-end in un browser vero  fatto
G3 ████████████████████ il prezzo massimo tornava incomprensibile  fatto
G4 ████████████████████ accessori scambiati per l'oggetto  fatto
G5 ████████████████████ home: un esempio vero al posto delle statistiche  fatto
G6 ████████████████████ l'attesa diventa una lingua sola  fatto

H1 ████████████████████ tre livelli al posto di undici blocchi pari  fatto
H2 ████████████████████ i comparabili hanno una faccia               fatto
H3 ████████████████████ le occasioni dai comparabili                 fatto
H4 ████████████████████ otto correzioni dal vivo                      fatto
H5 ████████████████████ il cruscotto: sto guadagnando?                fatto
H6 ████████████████████ il conto a tre righe, il retro del cartellino  fatto

I1 ████████████████████ ci sei gia' passato                           fatto
I2 ████████████████████ il tuo metro: la calibrazione personale       fatto
I3 ████████████████████ quello che ci hai speso sopra                 fatto
I4 ████████████████████ l'email al terzo oggetto                      fatto
I5 ████████████████████ l'identificazione a eventi                    fatto
I6 ████████████████████ revisione dei testi                            fatto
```

---

## Fatto

### Prerequisito — aritmetica onesta (`5ad7f4e`)
- Il peso della liquidita' (25% costante, sempre `unknown`) si ridistribuisce
  fra margine e confidenza, e torna alla liquidita' appena il mercato viene
  osservato davvero.
- Il prezzo massimo passa da bisezione sul punteggio a **sottrazione
  verificabile**: valore atteso − commissioni − spedizione − cuscinetto di
  rischio − margine obiettivo. Ogni riga viaggia nel risultato.
- Il verdetto diventa la fascia in cui cade il prezzo, non una seconda lettura
  del punteggio: prima potevano contraddirsi.
- 17 test nuovi. Il vecchio calcolo del prezzo massimo non era coperto da
  nessuno.

### E1 — blocco decisione (`fa7b480`)
- Verdetto, deal score, valore, prezzo massimo e le tre fasce come barra unica
  con indicatore, subito sotto l'identita'.
- Il verdetto prende il colore pieno, ma solo quando e' un si'.
- Foto da 4:3 a tutta larghezza a miniatura: prendeva 257px del primo viewport.
- Il prezzo massimo si apre e si controlla riga per riga.
- «Forse» → «Tratta».
- `zones.ts` puro, 11 test. `ResultView` da 471 a 373 righe.

### E2 — prove dell'identificazione (`e6d36e7`)
- `confidenceReasons` finalmente in pagina: il modello scriveva gia' perche'
  la confidenza e' alta o bassa, e l'interfaccia mostrava solo la percentuale
  nuda. Una percentuale senza motivi si puo' solo credere; con i motivi si
  puo' controllare.
- I marchi letti in evidenza e in monospazio, dichiarati come trascrizione da
  verificare, non come attributo dedotto.
- Dettagli dell'oggetto in forma editoriale, difetti visti nelle foto in
  evidenza, e «quale foto manca» invece di un invito generico.
- Avviso quando le foto sono di qualita' mista o scarsa: e' evidenza sulla
  nostra evidenza.
- Sparita la disclosure «Dettagli dell'oggetto»: era tutto li' dentro, chiuso.
- `ResultView` da 373 a 337 righe.

### E3 — mercato come prova (commit successivo)
- Una sezione «Sul mercato» al posto di tre pezzi sparsi: concorrenza,
  comparabili usati, comparabili scartati e lettura del mercato erano in
  quattro punti diversi, tre dentro accordion chiusi.
- Le quattro inserzioni piu' pesanti stanno aperte, il resto si piega:
  mostrarne trenta scaricherebbe su chi legge il lavoro di scegliere.
- Il peso di ogni inserzione e' in chiaro — e' il motivo per cui una ha
  spostato la stima piu' di un'altra.
- «Sono tutti prezzi richiesti» dichiarato una volta in testa invece che
  ripetuto su ogni riga, dove diventava un'etichetta che non si legge piu'.
- Gli scarti hanno il loro motivo accanto: e' la meta' meno vistosa della
  prova, e l'unica che dimostra che qualcuno ha guardato.
- Ordine della pagina corretto: il mercato e' prova per la decisione, stava
  dopo la storia.
- `ResultView` da 337 a 218 righe — da 471 all'inizio della fase.

### E4 — rischi in una sezione sola (commit successivo)
- `collectRisks` raccoglie i segnali che prima erano sparsi in cinque posti:
  confidenza dell'identificazione, qualita' delle foto, livello dei
  comparabili, dimensione del campione, dispersione, stato di conservazione,
  avvisi della pipeline.
- Due segnali nuovi che nessuna sezione dava: **la spedizione che si mangia
  l'oggetto** (9 € su una stima da 15 € sono il 60%) e **«nessun difetto
  trovato» non e' «nessun difetto»** quando mancano ancora delle foto.
- Non ripete cio' che e' vero sempre: i prezzi richiesti restano dichiarati
  nella sezione mercato. Un avviso che c'e' sempre insegna a saltare l'elenco.
- Un elenco vuoto e' una risposta e si dice, distinguendo «nessun rischio
  rilevato» da «nessun rischio».
- Funzione pura, 10 test. `ResultView` a 209 righe.

### E5 — economia del flip (commit successivo)
- Il conto si legge dall'alto in basso come lo farebbe chi rivende: lo
  rivendi a, meno commissioni, meno spedizione, meno quanto hai pagato, ti
  resta. Prima erano quattro celle con «margine atteso» come etichetta di un
  numero che nessuno aveva visto nascere.
- Aggiunti i due estremi della fascia: quanto resta vendendo al minimo e al
  massimo. Un margine che regge anche al minimo e' un'altra cosa rispetto a
  uno che esiste solo vendendo al massimo.
- `economicsAt` esportata da `flip-score`: l'interfaccia usa la stessa
  aritmetica del motore invece di riscriverla e rischiare che divergano.
- Dichiarato che commissioni e spedizione sono stime medie, non tariffe lette
  dal marketplace di chi legge.
- `ResultView` a 189 righe, da 471 all'inizio della fase.

**Ordine finale della pagina risultato:** identita' → decisione → prove
dell'identificazione → perche' quel verdetto → il conto → il mercato →
i rischi → la storia.

### E6 — prima di comprare, e guida fotografica (commit successivo)
- Campo nuovo `physicalChecks` nello schema: da 2 a 5 controlli da fare con
  l'oggetto in mano. Primo cambio di contratto della fase — trascina prompt,
  tre fixture e cinque costruttori nei test.
- Il prompt tiene separate le due cose che sembravano una: `missingShots`
  sono foto che servono a *noi* per identificare meglio, `physicalChecks`
  sono verifiche che servono a *chi compra* e che nessuna fotografia puo'
  fare — un suono, un peso, una giuntura, un meccanismo da provare.
- La sezione sta in fondo apposta: si legge a decisione presa, come ultimo
  passaggio prima di pagare.
- Guida fotografica da sette chip identici per ogni oggetto a tre gruppi con
  un motivo ciascuno: sempre / quelle che cambiano il risultato / lo stato.
  La guida davvero specifica resta `missingShots`, che arriva dopo la prima
  analisi quando sappiamo cos'e'.

**Ordine finale della pagina risultato:** identita' → decisione → prove
dell'identificazione → perche' quel verdetto → il conto → il mercato →
i rischi → prima di pagare → la storia.

### F1 — l'esito reale (commit successivo)
- **Il prezzo del banco non era un acquisto.** Il numero digitato per avere
  il verdetto finiva in `purchase_price`, e lo stato "comprato" veniva
  dedotto dalla sua sola presenza: l'inventario dichiarava acquisti mai
  fatti e il totale "speso" sommava soldi mai usciti. Ora c'e'
  `asking_price` per la domanda del venditore, e `purchase_price` si scrive
  solo quando dichiari di aver comprato. Migrazione con backfill: tre righe
  spostate, nessun valore perso.
- **Stato `passed`.** Chi non compra non lasciava traccia, e un magazzino
  che registra solo i "si'" non puo' dire se un "lascia stare" era giusto.
- Nuovi campi: `listed_at` (giorni sul mercato, diversi dai giorni di
  possesso), piu' `sale_price`/`sale_date`/`marketplace` che esistevano da
  sempre e nessuno scriveva.
- Due vincoli nello schema: niente `sold` senza prezzo di vendita, niente
  vendita prima dell'acquisto. Verificati contro il database vero.
- `describeOutcome` puro, 10 test: trattativa (chiesto − pagato), margine
  lordo (due cifre digitate da te, verificabili), netto stimato (dichiarato
  come stima), giorni tenuti e giorni sul mercato.
- **Il confronto con la fascia.** Un venduto dice se il prezzo e' caduto
  dentro, sotto o sopra la stima che avevamo dato. E' l'unico punto in cui
  il prodotto puo' essere smentito.
- L'inventario diventa un cruscotto a due piani: sopra le previsioni,
  sotto i fatti — guadagnato davvero e **stime centrate** (`n/m`). Il
  margine atteso non conta piu' i venduti: la' non e' piu' atteso.
- `recordOutcome` valida l'input con Zod: un'azione server e' un endpoint
  pubblico come tutti gli altri.

### F2 — autenticita' a livelli (commit successivo)
- Campo nuovo `authenticity`, nullable: quanta evidenza c'e' (`level`), cosa
  la sostiene, cosa non torna, cosa guardare. Mai un verdetto. Null quando
  non c'e' nessuna attribuzione da verificare — un oggetto anonimo non puo'
  essere ne' vero ne' falso.
- Barra a quattro tacche invece di una percentuale: una percentuale
  sull'autenticita' si legge come probabilita' di essere originale, che e'
  il numero che non abbiamo. La quarta tacca non si accende mai.
- `concerns` entra nei rischi al livello grave: se il pezzo non e' quello
  che sembra, i comparabili sono di un altro oggetto e la fascia non vale.
- Salvato su `items.authenticity`: un dubbio registrato oggi non deve
  diventare un fatto fra sei mesi solo perche' nessuno lo ripete.
- **Un tetto aritmetico, non solo un divieto nel prompt**
  (`services/ai/grounding.ts`): senza nemmeno un marchio letto nelle foto,
  `strong` scende a `consistent`. Un divieto e' una speranza.

### Il test vero che ha cambiato il modello (stesso commit)
Provando `authenticity` su una foto reale — la Olivetti Valentine di
`bench/photos` — sono uscite tre invenzioni scritte con la stessa sicurezza
di un marchio letto: «finiture in ottone appropriate all'epoca», «tastiera
QWERTY italiana» su una tastiera visibilmente **AZERTY**, e la parola
«autentica» che il prompt vietava. Il prompt e' stato stretto, e le parole
vietate sono sparite in 3 run su 3.

Ma il problema vero era sotto. **Haiku ha letto il modello giusto 2 volte su
9**, rispondendo «Lettera 32» a una macchina che ha «valentine» in rilievo
sul frontale, e una volta inventando la marca «Valentino». Con
`bench/compare-models.mjs` — quattro campi — la stessa foto dava «Valentine»
senza sbagliare: la scelta di Haiku era stata verificata contro uno schema
molto piu' leggero di quello che l'applicazione usa davvero.

Sonnet, schema vero e stessa foto: **3 su 3**, con le prove ancorate a cio'
che si vede. L'identificazione e' passata a Sonnet: 0,0035 $ → 0,0128 $ a
foto, ~0,015 $ per analisi completa. Il motivo non e' la qualita' in
astratto — se marca e modello sono sbagliati, eBay cerca un altro oggetto e
la fascia che esce e' il prezzo di quell'altro oggetto. E' l'unico errore
del prodotto che non ha modo di dichiararsi.

### F3 — ogni analisi ha un indirizzo (commit successivo)
- **Il pulsante «Salva» non c'e' piu': l'analisi si salva da sola** appena
  finisce. Prima un tocco sbagliato buttava minuti di attesa e qualche
  centesimo, e restava salvato solo cio' che valeva la pena tenere — cioe'
  proprio la meta' del magazzino che non insegna niente.
- `valuations.snapshot`: l'analisi come e' stata mostrata, per rimostrarla
  identica. Il verdetto non entra, ed e' il punto: e' funzione del prezzo che
  stai digitando adesso, non di quello di ieri, e si ricalcola con
  `assessFlip`. Congelarlo vorrebbe dire mostrare il verdetto di un prezzo
  che nessuno sta piu' guardando.
- `AnalysisSnapshotSchema`, con due controlli in compilazione: uno tiene
  compatibili i tipi, l'altro confronta gli **insiemi di chiavi**. Senza il
  secondo un campo aggiunto a `AnalysisResult` e dimenticato nello schema
  passerebbe inosservato — TypeScript accetta i campi in piu' — e un'analisi
  salvata perderebbe un pezzo in silenzio.
- Un test costruisce l'analisi dalle risposte registrate e la fa rientrare
  dallo schema: il controllo sui tipi garantisce che i campi ci siano, non
  che i valori passino.
- L'indirizzo cambia con `history.replaceState`, non navigando: una
  navigazione rimonterebbe la pagina e butterebbe via il risultato appena
  arrivato per rileggerlo dal database un istante dopo.
- Il prezzo del banco si scrive dopo il salvataggio, quindi si aggiorna
  mentre lo digiti — con 900 ms di attesa, perche' per «18,50» sarebbero
  cinque scritture e quattro numeri sbagliati salvati per strada.
- **Archiviare, mai cancellare** (`items.archived_at`). L'inventario ora
  raccoglie anche quello che hai guardato di sfuggita, e senza un modo di
  togliere di mezzo la lista diventa inservibile. Ma non c'e' nessun pulsante
  per cancellare: un oggetto scartato e' il dato piu' difficile da
  raccogliere che questo prodotto abbia. Quanti sono gli archiviati si dice
  sempre, anche quando la lista e' vuota — e' l'unico punto da cui si
  potrebbe restare senza una strada per tornare a prenderli.
- Le schede salvate prima di oggi non hanno snapshot e continuano a
  funzionare: `LegacyItemDetail` mostra quello che si ricostruisce dalle
  colonne. Non e' codice di passaggio — ci finisce anche qualunque snapshot
  il cui JSON non superi piu' lo schema.

### G1 — le aste, e il mercato dei dati sui venduti (commit successivo)
Nato dall'analisi competitiva: tutti i concorrenti spingono sui *sold prices*.
Prima di comprare qualcosa, la verifica.

**Nessuna fonte lecita esiste.** La parola nascosta nella decisione del 9
settembre non era «gratuita», era «lecita»: Marketplace Insights e' chiusa ai
nuovi utenti, la Finding API e' morta a febbraio 2025, Terapeak e' solo
interfaccia, LiveAuctioneers/Invaluable/Barnebys espongono API *in entrata*
per le case d'asta, WorthPoint e' un abbonamento consumer. Tutto cio' che
restituisce un prezzo di vendita e' uno scraper — e dal 22 luglio 2026 anche
il filtro «venduti» del sito eBay e' dietro login. Nessun acquisto fatto.

**Ma un segnale legittimo c'era, e lo buttavamo da sempre.**
- `price` e' **opzionale** sulle inserzioni eBay: 18 aste su 20 non ce
  l'hanno, portano solo `currentBidPrice`. Lo schema lo pretendeva, quindi
  `safeParse` falliva e l'inserzione spariva senza una riga di log. Le aste
  non sono mai entrate nel campione, mentre il commento nel codice diceva il
  contrario. Uno schema severo su un campo facoltativo non protegge: nasconde.
- Le aste vanno chieste **a parte**: col filtro combinato ne tornano 24 su
  250, da sole 213. Ora c'e' un giro dedicato.
- Un'offerta in corso non e' un prezzo richiesto: e' `bid`, un tipo nuovo.
- **E non entra nella stima.** Misurato su 446 aste reali: l'offerta corrente
  sta fra il 12% e il 71% della mediana dei prezzi fissi, e non converge
  nemmeno nelle ultime due ore. Nessun fattore di correzione — sarebbe lo
  sconto sintetico gia' escluso. E' un pavimento, come `lowest_price` di
  Discogs, e si mostra come tale: «su 55 aste aperte qualcuno ha gia' offerto
  fino a 154 €».
- `ebaySoldSearchUrl`: un link che apre i venduti sul sito di eBay. Non li
  mettiamo nella stima, ma li mettiamo a un tocco da chi sta al banco.
  Avvertenza in pagina: serve essere loggati.
- `bench/auction-bids.mjs` rifa' la misura quando serve.

### G2 — il giro completo, con un browser vero (commit successivo)
Il buco che avevo dichiarato in F3 e non potevo chiudere da solo: nessuno
aveva mai percorso il flusso cliccando. Ora `npm run e2e` lo fa in ~30
secondi — foto, analisi, indirizzo, prezzo, comprato, venduto, archiviato —
con Chrome e Supabase veri, e cancella l'oggetto che crea.

**Al primo colpo ha trovato due bug che typecheck, lint, build e 170 test
unitari avevano lasciato passare.**

1. **`<SavedAnalysis>` era nella pagina due volte.** Un residuo della mia
   chirurgia su `page.tsx` in F3: l'analisi salvata veniva renderizzata due
   volte, con due campi prezzo e due schede identita'. Nessuno strumento
   statico ha niente da ridire su un componente valido usato due volte.
2. **Il prezzo digitato veniva azzerato subito dopo essere stato salvato.**
   Il guardiano «salta la prima esecuzione dell'effetto» viene consumato dal
   doppio montaggio di React in sviluppo, e il secondo giro scriveva il
   valore iniziale — `null` — sopra quello appena registrato. Ora il
   confronto e' col valore gia' scritto (`useAskingPrice.ts`), quindi
   l'effetto e' idempotente.

Piu' una svista mia: `setAskingPrice` non controllava le righe aggiornate,
quindi un update bloccato dalla RLS sarebbe tornato `ok: true`. Come in
`recordOutcome`, ora chiede indietro l'id.

Playwright pilota il Chrome installato (`channel: 'chrome'`): questa macchina
gira su macOS 12 e i browser scaricati da Playwright non lo supportano piu'.

### G3 — «vale 30–70 ma oltre i 20 e' troppo?» (commit successivo)
Segnalato dal vivo, ed era un difetto vero, non un problema di parole.

**Il guadagno obiettivo era una quota del venduto, e la spedizione costa
uguale a ogni prezzo.** 9 € sono il 20% di un oggetto da 45 € e l'1,6% di uno
da 550, e si toglievano prima della quota. Cosi' la stessa riga di
configurazione pretendeva un ritorno del **163%** per dire «compralo» sotto i
50 €, e del **95%** sopra i 500. Sui mercatini, che stanno tutti in fondo a
quella scala, l'app diceva di lasciar stare affari buoni.

Ora il guadagno si misura su quello che spendi (`dealRoi`, 50%): la richiesta
e' la stessa a ogni livello di prezzo. Misurato: il ritorno preteso passa da
95–163% a **88–110%** su tutta la scala, e su una fascia 30–70 € l'affare
sale da 12 € a 15 €.

**E la pagina non collegava i due numeri.** «Vale 30–70» accanto a «paga fino
a 15» si legge come una contraddizione, e la spiegazione stava chiusa in un
accordion. Ora c'e' una riga sempre visibile: *di 240 € che incassi
vendendolo, in mano te ne restano 178 — il resto se ne va in commissioni,
spedizione e in quello che teniamo da parte perche' la stima puo' sbagliare.*

Il resto della pagina, sulla stessa segnalazione («troppe info dopo la
valutazione»):
- **Una scheda in meno.** Punteggio e «cosa lo muove» erano un blocco a se'
  subito sotto il verdetto: due numeri grandi che rispondono a domande
  diverse. Ora e' una riga piegata, piu' in basso.
- **Ordine rifatto:** decisione → il conto → il mercato → i rischi → prove
  dell'identita' → prima di pagare. Prima le prove dell'identificazione
  arrivavano seconde, quando la domanda successiva e' ancora sui soldi.
- **Il titolo e' marca e modello,** non il nome lungo scritto per un annuncio:
  «Olivetti Valentine» invece di quattro righe che spingevano il verdetto
  sotto la piega.
- **Parole:** «Vale» → «Lo rivendi a» (non e' quanto vale in mano tua, e'
  quanto lo paga chi lo comprera'); «troppo» → «niente margine» (sopra la
  soglia non e' vietato comprare, e' che non ci resta niente); «trattabile» →
  «margine sottile».
- `e2e/schermata.spec.ts`: uno strumento per guardare la pagina su uno schermo
  da telefono invece di immaginarla. Non gira con `npm run e2e`.

### G4 — «Cinghie per custodia» non e' una macchina da scrivere (commit successivo)
Visto in una schermata mentre si sistemavano i copy: il comparabile **piu'
pesante** di una Olivetti Valentine da 240 € era un paio di cinghie da 55 €,
classificato *stesso modello* con peso 0,85.

`inferMatchLevel` legge marca e modello nel titolo, e un ricambio li porta
entrambi: entra da `exact_model`, il livello col peso massimo e senza filtri
sopra. Lo scarto dei prezzi fuori scala non lo prende — 55 su 240 non e'
cinque volte sotto il mediano.

**La prima versione del filtro era sbagliata, e la misura l'ha detto subito:**
un elenco di parole applicato ovunque nel titolo scartava 30 inserzioni su
100 sulla Valentine, di cui la maggioranza erano l'oggetto vero — «Typewriter
**with Case**», «macchina da scrivere **manuale**», «Nikon FM2N **Manual**
Camera». Toglieva piu' comparabili buoni che accessori.

Quello che distingue non e' la parola ma **dove** sta, e la marca segna il
confine: prima di «Olivetti» c'e' cosa si vende, dopo c'e' cosa viene
insieme. Due eccezioni, trovate misurando e non ragionando:
- il **lotto**: «Case Straps — Set of 2» nomina l'accessorio dopo la marca, ma
  un insieme di due non e' mai l'oggetto;
- la **preposizione**: «[Top neuwertig **mit Riemen**] Nikon FM2» mette
  l'accessorio prima della marca dentro una nota fra parentesi, e senza
  guardare la parola che lo precede il filtro buttava via una FM2 in ottimo
  stato.

Misurato su cinque oggetti e cinque mercati: **13 scarti su 100 sulla
Valentine — tutti accessori veri — 2 sul Tolomeo, zero su Canon AE-1, Nikon
FM2 e Seiko 5.** Una variante che guardava anche il prezzo prendeva qualche
ricambio in piu' ma buttava una FM2 funzionante venduta «with strap» a 82 €:
scartata, perche' togliere comparabili veri alza la stima e fa pagare di piu'.

Effetto sulla stima della Valentine, pipeline vera: **135–300 € (probabile
240) → 185–310 € (probabile 265)**. Il minimo sale di cinquanta euro perche'
non lo tirano piu' giu' i nastri e le cinghie.

`bench/accessories.mjs` rifa' la misura. Ogni parola dell'elenco e' stata
tenuta o tolta guardando quel comando su inserzioni reali.

### G5 — la home mostrava le sue statistiche, non la sua risposta (commit successivo)
Il blocco «5 mercati eBay · 0,006 € per analisi · 3 livelli di comparabili»
era fatto da manuale d'officina: dice come funziona il motore a chi non sa
ancora cosa ottiene. **E una delle tre cifre era diventata falsa da sola** —
0,006 € era il costo con l'identificazione su Haiku, e da G2 giriamo su
Sonnet a piu' del doppio. Nessuno se n'era accorto perche' niente la
ricalcolava.

Al suo posto c'e' la risposta, com'e' fatta davvero: *Un vaso al mercatino.
Costa 18 € → COMPRALO → lo rivendi a 55–70 € → paga fino a 28 €*, con la
stessa barra a tre fasce della pagina vera. **I numeri li calcola il motore**
(`priceThresholds`, `recommendationAt`) e i componenti sono quelli veri
(`PriceZones`): se cambia l'aritmetica cambia anche la vetrina, invece di
restare indietro.

E un passaggio sulle etichette opache, dalla stessa segnalazione:
- «Quanto te lo chiedono» → **«Quanto costa»**. Era gergo da mercatino: la
  nuova e' la domanda che fai al venditore, con le stesse parole.
- «Quanto regge l'attribuzione» → «Quanto e' sicuro che sia questo».
- «86 annunci usati» → «86 annunci nella stima». Voleva dire *usati per la
  stima* e si leggeva *annunci di roba usata*, che qui sono tutti.
- «Se lo molli a 135 €» → «Se scendi a 135 €».

### G6 — l'attesa, da cinque soluzioni a una (commit successivo)
C'erano cinque modi diversi di dire «sto lavorando» e un buco grosso:
`find src/app -name "loading.tsx"` non restituiva niente. `/inventario` e
`/inventario/[id]` sono `force-dynamic` — interrogano Supabase e firmano gli
URL delle foto a ogni richiesta — e fra il tocco e la pagina **non succedeva
niente**. Su un telefono sembra che l'app si sia piantata.

Tre pezzi, stessi token e stessa curva di movimento:
- **Scheletri a forma del contenuto** (`components/Skeleton.tsx`, due
  `loading.tsx`). Next li prefetcha, quindi la navigazione diventa immediata.
  L'intestazione resta quella vera: non dipende dai dati, e disegnarla in
  grigio farebbe sfarfallare una cosa che non cambia.
- **Un punto che pulsa** per le attese brevi, su `Button` e sul nuovo
  `TextButton`. Prima ogni punto si arrangiava cambiando la parola —
  «Salvo…», «Archivio…», «Annullo…», «Rimetto…», «Un momento…» — cioe' cinque
  invenzioni per lo stesso momento, e il testo che cambia sposta quello che
  viene dopo. Ora l'etichetta resta l'azione. Ritardo di 120 ms: un'azione da
  un battito non produce un lampo.
- **Un blocco a passi per l'analisi** (`AnalysisProgress`), che dura fra i
  trenta secondi e i due minuti ed era una frase che sfarfallava in opacita'.
  I tre passi si accendono sugli eventi veri dello stream e ognuno, chiudendo,
  lascia il suo risultato: il nome dell'oggetto, quante inserzioni ha dato
  eBay. La barra del passo in corso e' indeterminata apposta.

Piu' `useLinkStatus` nella barra di navigazione, per i casi in cui il
prefetch non e' arrivato in tempo.

**Due cose viste guardando, non ragionando.** La prima: il blocco dei passi
finiva *sotto* la guida fotografica, quindi durante l'attesa si guardavano i
consigli su cosa fotografare invece del lavoro in corso — ora la guida sparisce
mentre l'analisi gira e i passi stanno in cima. La seconda: `inline-block
hidden` non nasconde niente, perche' sono due utility di display nella stessa
cascata e vince quella che nel CSS generato viene dopo. Il punto d'attesa e'
rimasto acceso su ogni bottone finche' una schermata ingrandita non l'ha
mostrato; typecheck, lint e 178 test non avevano niente da dire.

---

## Prossimo — da scegliere

La fase P1 concordata e' chiusa. Cosa resta, dal piano:

- **Second Look** — ora e' implementabile: l'analisi ha un indirizzo e uno
  snapshot da confrontare.
- **Modalita' trattativa**, **analisi del marchio**, **sessione di mercato**,
  **dati d'asta**.
- **P2**: multi-oggetto, Scout, allerte, analytics personali, escalation a
  esperto.

---

## Backlog

### P1
Second Look (ora implementabile: l'analisi ha un indirizzo e uno snapshot da
confrontare) · analisi del marchio · modalita' trattativa · sessione di
mercato · dati d'asta.

### P2
Multi-oggetto · Scout · allerte · analytics personali · escalation a esperto.

---

## Decisioni prese

| Questione | Decisione | Quando |
|---|---|---|
| Peso della liquidita' costante al 25% | Ridistribuito, restituito se il mercato viene osservato | `5ad7f4e` |
| Prezzo massimo non ispezionabile | Riscritto come sottrazione | `5ad7f4e` |
| Domanda e tempi di vendita | Restano `unknown` dichiarato: la ricerca agentica costa 160× | piano |
| Similarita' in percentuale | No: abbiamo 4 livelli e un peso, non una misura ottica | piano |
| Prezzo del banco salvato come acquisto | Separato: `asking_price` e' la domanda, `purchase_price` lo dichiari tu | F1 |
| Identificazione su Haiku | A Sonnet: 2/9 contro 3/3 sullo schema vero, non su quello del bench | F2 |
| Salvare l'analisi era un pulsante | Automatico: ogni analisi ha un indirizzo, e si archivia invece di cancellarla | F3 |
| Comprare l'accesso ai venduti | No: nessuna fonte lecita esiste, solo scraper. Verificato il mercato dei dati | G1 |
| Offerte d'asta nella stima | No: 12–71% dei prezzi fissi, nessun fattore di correzione. Pavimento dichiarato | G1 |
| Guadagno obiettivo come quota del venduto | Sul capitale speso: la stessa quota chiedeva il 163% sotto i 50 € e il 95% sopra i 500 | G3 |

## Migliorie note, non ancora fatte

- **Restano i ricambi intitolati come l'oggetto.** «Macchina da scrivere
  Olivetti Valentine barretta barra anteriore» a 90 € vende una barretta, ma
  comincia col nome dell'oggetto: la regola di posizione non puo' prenderlo, e
  nemmeno dovrebbe provarci a costo di falsi positivi. Serve un segnale
  diverso — forse la distanza dal mediano *insieme* alla parola, misurata
  meglio di come l'ho misurata io.

- **`confidenceReasons` non ha polarita'.** Sono stringhe: non sappiamo quali
  sostengono l'attribuzione e quali la indeboliscono, quindi si mostrano
  neutre. Aggiungere un segno per ciascuna e' un cambio di schema piccolo e
  un guadagno di leggibilita' grosso.
- **Manca l'origine geografica** fra i dettagli dell'oggetto: il modello non
  la produce. Campo nuovo nello schema quando servira'.

### H1 — tre livelli al posto di undici blocchi pari (commit successivo)
- La pagina risultato aveva undici blocchi con lo stesso identico trattamento
  grafico: stesso bordo, stesso fondo, stesso padding, stesso raggio. Il conto
  del flip e «Cos'e', in breve» pesavano uguale.
- `Card` prende un livello (1 risposta / 2 prove / 3 il resto) e la palette si
  rifa attorno al tratto spesso con l'ombra piena, che e' l'unico linguaggio
  in cui tre livelli si distinguono da lontano — che e' la condizione d'uso
  vera: un telefono, in mano, al sole, col venditore che aspetta.
- **Il conto era stampato due volte.** Guardandole vicine si vede perche' non
  sono due conti: le prime tre righe sono identiche, e da li' cambia solo cosa
  sottrai. `Ledger` scrive il tronco una volta e ne fa uscire i due rami.
- «Prima di pagare» sale sotto il verdetto: sono i gesti dei dieci secondi
  dopo aver letto COMPRALO, non un epilogo.
- Prove dell'identificazione, autenticita', punteggio e storia scendono sotto
  un'intestazione sola, tutti chiusi: una schermata invece di cinque.
- Tutti e tre i verdetti a colore pieno. Prima solo il si', perche' la palette
  non aveva un giallo e un rosso che reggessero del testo sopra.

### H2 — i comparabili hanno una faccia (commit successivo)
- La Browse API restituisce `image.imageUrl` su **20 inserzioni su 20**
  (misurato in produzione), e la buttavamo via. Ora ogni comparabile porta la
  sua miniatura: se il titolo eBay e' scritto per un motore di ricerca, la
  foto e' l'unico controllo che chi legge puo' fare al posto nostro.
- Lo schema che vede il modello resta senza `imageUrl`
  (`ModelMarketResearchSchema`): un campo in piu' non costa token, costa
  attenzione tolta a marca e modello.
- **Il peso si mostra solo se varia.** Leggeva «peso 1.00» su tutte le righe
  aperte, e adesso si sa perche': eBay dichiara la condizione su **3
  inserzioni su 20**, quindi uno dei due fattori del peso e' una costante
  sulle altre 17. Il conto si fa per elenco mostrato, non sull'insieme.
- **Bug trovato e corretto: l'indirizzo dell'analisi rubava la rotta.** Il
  risultato si riscriveva l'indirizzo in `/inventario/<id>` con
  `history.replaceState`, credendo che non fosse una navigazione. In App
  Router lo e': alla prima azione server successiva — il primo carattere del
  prezzo — il router rigenerava quella rotta, il risultato spariva dietro uno
  scheletro e il prezzo appena scritto si perdeva nella corsa col salvataggio
  ritardato. L'indirizzo e' ora `/analizza?oggetto=<id>`, stessa rotta, come
  prescrive `linking-and-navigating.md`. L'e2e era rosso su `main` per questo
  motivo e adesso lo verifica esplicitamente.

### H5 — il cruscotto (commit successivo)
- `/andamento` risponde a «sto guadagnando?», che l'inventario non chiedeva:
  quello dice cosa hai, questo dice se vale la pena continuare.
- Solo soldi veri. Le stime restano nell'inventario: un cruscotto che mescola
  quello che e' successo con quello che speri non si puo' usare per decidere.
- Spese nel mese in cui hai pagato, incassi nel mese in cui hai venduto,
  margine nel mese della vendita. `ledger.ts` e' puro, 8 test.
- Grafico in SVG scritto a mano: incassi sopra la riga dello zero, spese sotto.
  Nessuna libreria. L'asse dello zero si posiziona sui dati.
- Capitale fermo in un blocco a parte: non e' ne' guadagno ne' perdita, e'
  il soldo che non puoi rispendere finche' non vendi.
- L'e2e ci passa: comprato a 25, venduto a 90, il cruscotto dice +56 €.

### H6 — il conto a tre righe, e il retro del cartellino (commit successivo)
- Fuori anche le commissioni, dopo la spedizione: il conto e' `valore atteso −
  margine = prezzo massimo`. Cuscinetto di rischio e guadagno obiettivo sono
  una riga sola, sommati e non cancellati, cosi' la colonna torna e una stima
  fragile continua ad abbassare il massimo.
- «Che fine ha fatto» al posto di «Com'e' andata», e le due risposte spiegate
  per quello che danno a chi le da', non a noi.
- «Se vuoi controllare» diventa un pannello a colore pieno, e ogni blocco
  chiuso dichiara cosa contiene: «3 marchi letti», «2 cose non tornano».
- L'attesa dell'analisi prende tutto lo schermo, con la foto dell'oggetto.
- L'annuncio in scrittura ha lo scheletro della sua scheda: era l'ultimo punto
  dell'app con un'animazione inventata sul posto.
- Dalle inserzioni eBay arrivano anche paese, spedizione e voto del venditore.
  Le occasioni si confrontano ora anche col prezzo che ti chiedono al banco, e
  gli oggetti simili in vendita hanno un elenco a parte.

### I1-I5 — le cinque cose che mancavano a chi lo usa davvero (commit successivi)
- **Ci sei gia' passato**: lo stesso modello ricapita, e l'app non se ne
  accorgeva. Ora lo dice appena c'e' l'identificazione, prima della stima.
- **Il tuo metro**: dopo cinque vendite vere, `calibrate` misura a che quota
  della stima chiudono. Mediana e non media. E' il solo numero del prodotto
  che descrive chi lo usa invece del mercato.
- **Quello che ci hai speso sopra**: pulizia, ricambi, trasporto. Escono dalla
  stessa tasca del prezzo e non stavano da nessuna parte, quindi ogni margine
  del magazzino era piu' alto di quello vero.
- **L'email al terzo oggetto**: l'avviso c'era, ma in /account, cioe' nella
  sola pagina che nessuno apre.
- **L'identificazione a eventi**: misurato che il tempo sta li' e non nella
  ricerca (21 s contro 2,5 s). Il primo dato utile arriva ora dopo 3,4 s
  invece di 22,9. L'attesa dura uguale, e non si finge il contrario.
- Corretto in AGENTS il costo per analisi: 0,042 $ con una foto e ~0,10 $ con
  otto, non 0,015 $. Era la cifra di Haiku, mai aggiornata al passaggio a
  Sonnet.

### I6 — revisione dei testi (commit successivo)
- Contati prima: ventuno «X, non Y» e sei frasi sopra i novanta caratteri.
  Dopo: due e zero, e le due che restano sono quelle che se lo meritano.
- Quattro regole in AGENTS perche' il tic non ricresca: una frase un punto,
  «X, non Y» si spende una volta sola, un'etichetta non si difende da
  obiezioni che nessuno ha fatto, e il prodotto non parla di se'.

## Decisioni aperte

- **Autenticazione sulle API a pagamento.** `/api/identify` e `/api/valuate`
  sono protette solo da rate limit per IP. Ogni chiamata costa denaro vero.
- **Dati d'asta.** Unica via onesta ai prezzi realmente pagati: da verificare
  fattibilita' e termini d'uso prima di prometterla.
- **Verdetto salvato sulle righe vecchie.** `valuations.recommendation`,
  `flip_score` e `assessed_at_price` restano null sulle analisi salvate
  automaticamente: il prezzo del banco arriva dopo. Il verdetto si ricalcola
  in pagina dallo snapshot, che e' piu' onesto — ma il cruscotto non puo'
  ancora contare quante volte STYMA aveva detto «lascia stare» su cose che
  poi si sono rivelate affari. Serve per il punto 27 del piano.

---

## Vincoli che non cambiano

- Il modello non decide il prezzo.
- Niente dati inventati: venduti, domanda, autenticita', liquidita'. Se manca
  l'evidenza si dice.
- Ogni numero mostrato dev'essere verificabile da chi lo legge.
- Mobile prima: si usa in piedi, con una mano, davanti a un banco.
