# Foto di prova

`olivetti-valentine.jpg` e' la foto che corrisponde alla registrazione in
`bench/fixtures/`. E' 1280x1064 e pesa meno di 1,5 MB, quindi il
ridimensionamento lato client la lascia intatta: i byte inviati sono gli stessi
su cui e' calcolata la chiave della registrazione.

Serve a provare tutto il percorso (analisi, valutazione, salvataggio in
archivio) con `STYMA_AI_FIXTURES=1`, senza chiamare il modello e senza spendere.

Una foto qualsiasi non funziona in questa modalita': la registrazione e'
indicizzata sui byte dell'immagine. Per aggiungerne altre, un giro con
`STYMA_AI_RECORD=1` (che si paga) le registra.

Fonte: Wikimedia Commons.
