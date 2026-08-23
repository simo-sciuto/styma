-- Da dove venivano i comparabili di una valutazione salvata.
--
-- L'interfaccia dichiara l'eta' della ricerca al momento dell'analisi, ma
-- l'inventario perdeva quell'informazione: chi riapriva un oggetto fra un mese
-- vedeva la stessa forbice senza sapere se poggiava su una ricerca fatta al
-- momento o su una riusata da tre settimane prima. Le valutazioni qui sono
-- immutabili proprio perche' devono restare leggibili nel tempo: senza questo
-- dato la riga diventa piu' sicura di quanto fosse.
--
-- L'eta' in giorni non si memorizza: si ricava da created_at - market_researched_at.
-- Un valore derivato salvato accanto alle sue fonti prima o poi le contraddice.

alter table public.valuations
  add column market_researched_at timestamptz,
  add column market_research_cached boolean;

comment on column public.valuations.market_researched_at is
  'Quando e'' stata fatta la ricerca di mercato su cui poggia questa valutazione. Null se la ricerca non e'' andata a buon fine.';

comment on column public.valuations.market_research_cached is
  'True se i comparabili venivano dalla cache invece che da una ricerca fatta sul momento.';
