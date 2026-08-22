-- L'API Storage risolve il bucket con il ruolo di chi fa la richiesta.
-- Su storage.buckets la RLS e' attiva e senza policy: un bucket creato via SQL
-- esiste nella tabella ma per l'utente e' invisibile, e ogni upload risponde
-- "Bucket not found" — un 404 che sembra un bucket mancante ed e' invece
-- un permesso mancante.

drop policy if exists "item images bucket is visible to signed in users" on storage.buckets;

create policy "item images bucket is visible to signed in users"
  on storage.buckets for select
  to authenticated
  using (id = 'item-images');
