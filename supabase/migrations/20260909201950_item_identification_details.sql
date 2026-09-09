-- Il dettaglio dell'identificazione, salvato per intero.
--
-- Materiali, caratteristiche, difetti e marchi letti esistevano gia' in ogni
-- analisi (schema Identification), ma finivano solo in memoria: al momento
-- del salvataggio restava soltanto un riassunto (title/category/brand/model/
-- description/condition). Chi riapriva l'oggetto piu' tardi, o generava un
-- annuncio a partire da un pezzo gia' salvato, aveva meno da dire di quanto
-- l'analisi avesse davvero visto.

alter table public.items
  add column materials text[] not null default '{}',
  add column characteristics text[] not null default '{}',
  add column condition_notes text[] not null default '{}',
  add column markings text[] not null default '{}';

comment on column public.items.materials is
  'Materiali riconosciuti nell''identificazione (Identification.materials).';
comment on column public.items.characteristics is
  'Caratteristiche notevoli riconosciute (Identification.characteristics).';
comment on column public.items.condition_notes is
  'Difetti e segni d''uso rilevati (Identification.conditionNotes).';
comment on column public.items.markings is
  'Marchi, punzoni e numeri di serie letti (Identification.markings).';
