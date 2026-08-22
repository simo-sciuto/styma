-- Il percorso oggetti del servizio Storage risolve il bucket in un contesto di
-- ruolo diverso da quello della lista: con la policy limitata a `authenticated`
-- la lista bucket funziona e l'upload risponde "Bucket not found".
-- La visibilita' del solo bucket non espone nulla: gli oggetti restano protetti
-- dalle policy su storage.objects.

drop policy if exists "item images bucket is visible to signed in users" on storage.buckets;

create policy "item images bucket is visible"
  on storage.buckets for select
  to anon, authenticated
  using (id = 'item-images');
