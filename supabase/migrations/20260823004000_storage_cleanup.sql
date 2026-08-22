-- Revoca la policy temporanea che permetteva a un utente di creare il bucket.
-- Da qui in poi il bucket esiste e nessuno deve poterne creare altri.
--
-- Toglie anche la policy di lettura su storage.buckets: era stata aggiunta
-- inseguendo un errore "Bucket not found" che aveva tutt'altra causa (una URL
-- malformata nello script di prova, senza il nome del bucket). Il servizio
-- Storage risolve il bucket con le proprie credenziali: la policy non serve.

drop policy if exists "temp: item photos bucket can be created" on storage.buckets;
drop policy if exists "item photos bucket is visible" on storage.buckets;
