-- L'esito reale di un oggetto: cosa chiedevano, cosa hai pagato, a quanto
-- l'hai venduto e quanto ci ha messo.
--
-- Fino a qui l'inventario conservava la *stima* ma non il *risultato*: senza
-- il risultato non si puo' mai sapere se le stime erano giuste, e un motore
-- decisionale che non puo' essere smentito non e' un motore decisionale.

-- Quanto chiedeva chi vendeva. Non e' un doppione di purchase_price: uno e'
-- la domanda, l'altro e' quanto hai pagato davvero dopo aver trattato. La
-- differenza fra i due e' l'unica misura di quanto vale saper trattare, e
-- fin qui la buttavamo via.
alter table public.items
  add column asking_price numeric(10, 2) check (asking_price >= 0);

-- Quando e' finito in vendita. purchase_date dice da quanto lo tieni,
-- listed_at da quanto il mercato lo sta guardando senza comprarlo: sono due
-- domande diverse e la seconda e' quella che dice se il prezzo e' sbagliato.
alter table public.items
  add column listed_at date;

alter table public.items
  add constraint items_sale_after_purchase check (
    sale_date is null or purchase_date is null or sale_date >= purchase_date
  );

-- Uno stato "venduto" senza prezzo di vendita e' esattamente il buco che
-- rende inutile tutto il resto: si conta la vendita e non si sa a quanto.
-- Meglio impedirlo nello schema che scoprirlo leggendo un margine vuoto.
alter table public.items
  add constraint items_sold_needs_price check (
    status <> 'sold' or sale_price is not null
  );

comment on column public.items.asking_price is
  'Prezzo chiesto da chi vendeva, al momento dell''analisi.';
comment on column public.items.purchase_price is
  'Quanto hai pagato davvero. Null finche'' non dichiari di averlo comprato.';
comment on column public.items.listed_at is
  'Data di messa in vendita, per contare i giorni sul mercato.';

-- Le righe gia' salvate portano nel prezzo pagato un numero che nessuno ha
-- mai pagato: era il prezzo digitato davanti al banco per ottenere il
-- verdetto, e lo stato "comprato" veniva dedotto dalla sua sola presenza.
-- Nessun valore si perde, si sposta dove e' vero. purchase_date e' sempre
-- null perche' fino a questa migrazione nessuno lo scriveva: e' la firma
-- esatta delle righe create da quell'automatismo.
update public.items
   set asking_price = purchase_price,
       purchase_price = null,
       status = 'found'
 where status = 'bought'
   and purchase_date is null
   and purchase_price is not null;

create index items_user_id_status_idx on public.items (user_id, status);
