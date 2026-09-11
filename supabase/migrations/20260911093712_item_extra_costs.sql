-- Quello che un oggetto ti e' costato oltre il prezzo di acquisto.
--
-- Finche' il conto era `venduto meno pagato`, il margine del magazzino era
-- sempre piu' alto di quello vero: la pulizia, i ricambi, la corriera e
-- l'ingresso al mercato non stavano da nessuna parte. Adesso che commissioni
-- e spedizione sono uscite dai calcoli, quel buco e' l'unico rimasto, ed e'
-- l'unico che chi rivende paga davvero di tasca sua.
--
-- Una cifra sola e una nota: non una tabella di voci. Chi sta chiudendo una
-- vendita scrive «35, ricambi e pulizia» in tre secondi e va avanti; un modulo
-- a righe multiple non lo compila nessuno, e un dato che nessuno compila vale
-- meno di un dato approssimato.
alter table public.items
  add column if not exists extra_costs numeric(10, 2),
  add column if not exists extra_costs_note text;

-- Una spesa negativa non e' una spesa. Zero si', ed e' diverso da null:
-- «non ho speso altro» e «non l'ho ancora detto» sono due cose diverse.
alter table public.items
  drop constraint if exists items_extra_costs_non_negative;
alter table public.items
  add constraint items_extra_costs_non_negative
  check (extra_costs is null or extra_costs >= 0);

-- Costi extra senza un acquisto non hanno un oggetto a cui appartenere.
alter table public.items
  drop constraint if exists items_extra_costs_need_purchase;
alter table public.items
  add constraint items_extra_costs_need_purchase
  check (extra_costs is null or purchase_price is not null);

comment on column public.items.extra_costs is
  'Speso su questo oggetto oltre il prezzo di acquisto: pulizia, ricambi, trasporto, ingresso al mercato.';
comment on column public.items.extra_costs_note is
  'In che cosa, scritto da chi vende. Non e'' un elenco strutturato apposta.';
