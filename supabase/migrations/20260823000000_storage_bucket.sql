-- Policy di accesso alle foto degli oggetti.
--
-- Il bucket `item-images` NON viene creato qui. In questa versione di Supabase
-- il servizio Storage non registra i bucket inseriti direttamente in
-- storage.buckets: la riga esiste nella tabella ma ogni chiamata risponde
-- "Bucket not found". Un trigger `protect_buckets_delete` sulla stessa tabella
-- conferma che il ciclo di vita dei bucket e' passato sotto l'API.
--
-- Il bucket va quindi creato dalla Dashboard (Storage -> New bucket) o via API:
--   nome `item-images`, privato, limite 8 MB, MIME image/jpeg,image/png,image/webp
--
-- Queste policy sono ri-eseguibili.

drop policy if exists "users read their own item images" on storage.objects;
drop policy if exists "users upload their own item images" on storage.objects;
drop policy if exists "users replace their own item images" on storage.objects;
drop policy if exists "users delete their own item images" on storage.objects;

create policy "users read their own item images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'item-images'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "users upload their own item images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'item-images'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Update serve anche per l'upsert di un file gia' presente.
create policy "users replace their own item images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'item-images'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'item-images'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "users delete their own item images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'item-images'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
