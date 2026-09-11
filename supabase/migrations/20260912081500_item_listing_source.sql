-- Da dove veniva l'oggetto, quando veniva da un annuncio.
--
-- Un'analisi nata da un link mostrava la scheda «cosa dice l'annuncio» con il
-- collegamento per riaprirlo, ma quella scheda viveva solo nello stato del
-- browser: salvato l'oggetto e riaperto domani, il link non c'era piu' da
-- nessuna parte. E' proprio l'informazione che serve dopo — «quello che avevo
-- visto su Vinted e' ancora li'? a quanto sta adesso?» — e la si perdeva
-- esattamente quando cominciava a servire.
--
-- Due colonne e non di piu': l'indirizzo e la piattaforma. Titolo, marca e
-- categoria dichiarati dal venditore contano al momento della decisione, per
-- confrontarli con quello che vediamo noi; dopo, quello che resta utile e'
-- soltanto come tornare li'. Il prezzo chiesto ha gia' la sua colonna, ed e'
-- asking_price.
--
-- La migrazione 20260911223550 porta lo stesso nome ed e' vuota: la catena di
-- comandi che doveva scriverla si e' interrotta fra la creazione del file e il
-- suo contenuto, e il push ha applicato zero righe dichiarando successo. E'
-- rimasta dov'e' perche' la storia remota la conosce gia'; cancellarla
-- avrebbe rotto l'allineamento per guadagnare solo un file in meno.
alter table public.items
  add column if not exists listing_url text,
  add column if not exists listing_source text;

-- Solo le piattaforme che sappiamo leggere: un valore libero qui diventerebbe
-- un'etichetta che nessuno sa tradurre in pagina.
alter table public.items
  drop constraint if exists items_listing_source_known;
alter table public.items
  add constraint items_listing_source_known
  check (listing_source is null or listing_source in ('vinted', 'ebay'));

-- Una piattaforma senza indirizzo non porta da nessuna parte.
alter table public.items
  drop constraint if exists items_listing_source_needs_url;
alter table public.items
  add constraint items_listing_source_needs_url
  check (listing_source is null or listing_url is not null);
