-- Rendere ogni vendita reale un dato di calibrazione.
--
-- Lo sconto applicato ai prezzi richiesti (`askingToSoldRatio`, oggi 0,75) e'
-- un'assunzione scelta a tavolino, perche' i venduti non sono acquistabili da
-- nessuna fonte gratuita: Marketplace Insights e' chiusa a nuovi utenti, la
-- Finding API risponde 418, Discogs vuole OAuth da venditore.
--
-- Ma gli utenti di STYMA vendono davvero, e registrano il prezzo in
-- `items.sale_price`. Ogni vendita e' quindi un confronto fra cio' che avevamo
-- stimato e cio' che il mercato ha pagato. Perche' il confronto sia possibile
-- la valutazione deve ricordare due cose di se stessa: con quale sconto e'
-- stata calcolata, e su quante vendite confermate poggiava.
--
-- Senza il rapporto memorizzato, una riga calcolata con 0,75 diventerebbe
-- illeggibile il giorno in cui il valore cambia. Senza il conteggio dei
-- venduti, non si distingue una stima fatta su annunci — l'unica che dice
-- qualcosa sullo sconto — da una che aveva gia' vendite vere sotto.

alter table public.valuations
  add column asking_to_sold_ratio numeric(4, 3)
    check (asking_to_sold_ratio is null or asking_to_sold_ratio between 0 and 2),
  add column sold_comparable_count integer
    check (sold_comparable_count is null or sold_comparable_count >= 0);

comment on column public.valuations.asking_to_sold_ratio is
  'Sconto applicato ai prezzi richiesti al momento del calcolo. Serve a rileggere la riga quando il valore di configurazione cambia.';

comment on column public.valuations.sold_comparable_count is
  'Quante vendite confermate c''erano fra i comparabili. Zero significa stima ricavata solo da annunci: sono queste le righe che calibrano lo sconto.';
