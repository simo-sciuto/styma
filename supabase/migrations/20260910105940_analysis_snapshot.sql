-- L'analisi come e' stata mostrata, e un posto dove mettere quello che non
-- vuoi piu' vedere.
--
-- Un'analisi viveva nello stato del browser: bastava ricaricare per perderla.
-- Ora ogni analisi diventa subito un oggetto salvato e ha il suo indirizzo,
-- quindi l'inventario si riempie anche di cose che hai solo guardato: senza
-- un modo di toglierle di mezzo, la lista diventa inservibile proprio per
-- chi la usa di piu'.

-- Tutto cio' che serve a ricostruire la pagina: identificazione, ricerca di
-- mercato, provenienza dei comparabili, valutazione, avvisi. Il verdetto no:
-- e' funzione del prezzo che stai digitando adesso, e si ricalcola.
alter table public.valuations
  add column snapshot jsonb;

comment on column public.valuations.snapshot is
  'L''analisi come mostrata, per rimostrarla identica. Senza flip: si ricalcola dal prezzo digitato.';

-- Archiviato, non cancellato. Un oggetto che hai scartato resta il dato piu'
-- prezioso che questo prodotto raccoglie — dice se un "lascia stare" era
-- giusto — e cancellarlo per fare ordine lo butterebbe via.
alter table public.items
  add column archived_at timestamptz;

comment on column public.items.archived_at is
  'Fuori dalla lista, dentro i dati. Null = visibile.';

create index items_user_id_archived_idx on public.items (user_id, archived_at);
