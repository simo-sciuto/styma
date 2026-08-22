-- Policy di accesso alle foto, prima versione, sul bucket `item-images`.
--
-- NOTA STORICA: il commento originale di questo file attribuiva un errore
-- "Bucket not found" al fatto che il servizio Storage non registrasse i bucket
-- creati via SQL. Era sbagliato: la causa era una URL malformata nello script
-- di prova, priva del nome del bucket (/object/<path> invece di
-- /object/<bucket>/<path>). Il bucket in uso e le policy definitive sono nella
-- migrazione 20260823003000.

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
