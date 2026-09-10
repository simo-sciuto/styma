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

**Fase E — P0, il motore decisionale.** 6 passi su 6. Manca solo E6, che e' il primo
cambio di contratto.

```
E1 ████████████████████ blocco decisione            fatto
E2 ████████████████████ prove dell'identificazione  fatto
E3 ████████████████████ mercato come prova          fatto
E4 ████████████████████ rischi in una sezione sola   fatto
E5 ████████████████████ economia del flip            fatto
E6 ░░░░░░░░░░░░░░░░░░░░ prima di comprare + guida foto  prossimo
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

---

## Prossimo

### E6 — prima di comprare, e guida fotografica
Ultimo P0, e il primo cambio di contratto: serve un campo nuovo nello schema
di identificazione per i controlli fisici da fare davanti all'oggetto
(«guarda il fondo», «controlla le giunture»), che `missingShots` non copre —
quello parla di foto, non di cosa toccare con le mani. Trascina prompt e le
tre fixture registrate.

---

## Backlog

### P0 rimanenti
- **E3** mercato come prova: comparabili fuori dagli accordion, con peso e
  motivo di scarto, asking/sold esplicito.
- **E4** rischi raccolti in una sezione sola.
- **E5** economia del flip come blocco leggibile.
- **E6** «prima di comprare» + guida fotografica per tipo di oggetto.
  ← primo cambio di contratto: campo nuovo nello schema.

### P1
Autenticita' a livelli · analisi del marchio · Second Look (richiede prima
l'URL del risultato) · modalita' trattativa · My Finds con esito reale ·
sessione di mercato · dati d'asta.

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

## Migliorie note, non ancora fatte

- **`confidenceReasons` non ha polarita'.** Sono stringhe: non sappiamo quali
  sostengono l'attribuzione e quali la indeboliscono, quindi si mostrano
  neutre. Aggiungere un segno per ciascuna e' un cambio di schema piccolo e
  un guadagno di leggibilita' grosso.
- **Manca l'origine geografica** fra i dettagli dell'oggetto: il modello non
  la produce. Campo nuovo nello schema quando servira'.

## Decisioni aperte

- **Autenticazione sulle API a pagamento.** `/api/identify` e `/api/valuate`
  sono protette solo da rate limit per IP. Ogni chiamata costa denaro vero.
- **Dati d'asta.** Unica via onesta ai prezzi realmente pagati: da verificare
  fattibilita' e termini d'uso prima di prometterla.
- **URL del risultato.** Oggi l'analisi vive nello stato React. Senza
  persistenza il Second Look non e' implementabile.

---

## Vincoli che non cambiano

- Il modello non decide il prezzo.
- Niente dati inventati: venduti, domanda, autenticita', liquidita'. Se manca
  l'evidenza si dice.
- Ogni numero mostrato dev'essere verificabile da chi lo legge.
- Mobile prima: si usa in piedi, con una mano, davanti a un banco.
