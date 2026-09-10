-- Quanto le prove visibili sostenevano l'attribuzione, al momento
-- dell'analisi.
--
-- Non e' un giudizio di autenticita' e non deve diventarlo rileggendolo fra
-- un anno: dentro ci sono cosa si vedeva a sostegno, cosa non tornava e cosa
-- restava da guardare. Sta su `items` e non su `valuations` perche' parla di
-- cosa e' l'oggetto, non di quanto vale.
--
-- Null e' un valore pieno: un oggetto senza marca ne' autore non ha nessuna
-- attribuzione da verificare, e riempire il campo comunque insegnerebbe a
-- leggerlo come una formalita'.
alter table public.items
  add column authenticity jsonb;

comment on column public.items.authenticity is
  'Evidenza a sostegno dell''attribuzione: level, supports, concerns, toVerify. Mai un verdetto di autenticita''.';
