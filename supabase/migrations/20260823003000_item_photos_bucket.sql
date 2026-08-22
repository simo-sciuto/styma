-- Il bucket delle foto passa a `item-photos` e viene creato tramite l'API
-- Storage, non via SQL: il servizio tiene una cache dei bucket che si aggiorna
-- solo attraverso la propria API. Una riga inserita in storage.buckets esiste
-- nella tabella, compare nella lista bucket, e ciononostante ogni operazione
-- sugli oggetti risponde "Bucket not found".
--
-- La policy di INSERT su storage.buckets e' temporanea: serve solo perche' la
-- creazione avvenga con una sessione utente invece che con la chiave
-- service_role, che non deve stare nel repo. Viene revocata subito dopo.

drop policy if exists "item images bucket is visible" on storage.buckets;
drop policy if exists "users read their own item images" on storage.objects;
drop policy if exists "users upload their own item images" on storage.objects;
drop policy if exists "users replace their own item images" on storage.objects;
drop policy if exists "users delete their own item images" on storage.objects;

create policy "item photos bucket is visible"
  on storage.buckets for select
  to anon, authenticated
  using (id = 'item-photos');

create policy "temp: item photos bucket can be created"
  on storage.buckets for insert
  to authenticated
  with check (id = 'item-photos');

create policy "users read their own item photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'item-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "users upload their own item photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'item-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "users replace their own item photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'item-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'item-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "users delete their own item photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'item-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
