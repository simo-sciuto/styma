-- Non fingiamo piu' di stimare vendite: non esiste una fonte gratuita di
-- vendite concluse (Marketplace Insights e' chiusa a nuovi utenti, la
-- Finding API risponde 418, Discogs vuole un account venditore). La stima
-- si basa sempre su prezzi richiesti, e quello che conta e' se l'oggetto
-- confrontato e' davvero lo stesso modello, non se qualcuno l'ha venduto.
--
-- asking_to_sold_ratio e sold_comparable_count esistevano per uno sconto e
-- una calibrazione che non hanno piu' senso: si toglie il numero invece di
-- lasciarlo li' a suggerire un calcolo che non viene piu' fatto.

alter table public.valuations
  drop column asking_to_sold_ratio,
  drop column sold_comparable_count;

-- Al suo posto, la domanda che conta davvero: la forbice poggiava sullo
-- stesso identico modello, su oggetti solo simili perche' di identici non
-- ce n'erano abbastanza, o su una debole evidenza di categoria. Riletta fra
-- un mese, questa riga deve dire quanto fidarsene.
alter table public.valuations
  add column comparable_tier text check (comparable_tier in ('identical', 'similar', 'weak'));

comment on column public.valuations.comparable_tier is
  'Su cosa poggiava la forbice: identical (stesso modello), similar (oggetti vicini, dichiarato), weak (solo categoria). Null se la valutazione non era disponibile.';
