-- Cache delle ricerche di mercato.
--
-- Due persone che fotografano la stessa Olivetti Valentine cercavano due volte
-- e pagavano due volte. I comparabili descrivono il modello, non l'esemplare:
-- lo stato di conservazione lo applica la valutazione a valle. Quindi la
-- ricerca si puo' riusare, entro una scadenza che dipende da quanto in fretta
-- si muove quel mercato.
--
-- Non contiene dati di nessun utente: solo marca, modello e cio' che si e'
-- trovato in giro. Per questo non ha `user_id` e non risale a `items`.

create table public.market_research_cache (
  -- Marca e modello normalizzati, separati da "|". Vedi services/market-cache/policy.ts.
  cache_key text primary key,
  -- La ricerca cosi' come e' uscita dalla fusione delle corsie, gia' validata
  -- da MarketResearchSchema prima di arrivare qui.
  research jsonb not null,
  -- Ritmo del mercato: determina la scadenza. Tenuto anche come colonna per
  -- poter capire, guardando la tabella, perche' una riga vive piu' a lungo.
  market_pace text not null check (market_pace in ('slow', 'medium', 'fast')),
  comparable_count integer not null check (comparable_count > 0),
  researched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Quante analisi hanno riusato questa riga: dice quanto sta rendendo la cache.
  hit_count integer not null default 0
);

create index market_research_cache_expires_at_idx
  on public.market_research_cache (expires_at);

alter table public.market_research_cache enable row level security;

-- Nessuna policy, deliberatamente.
--
-- Con RLS attiva e zero policy la tabella e' irraggiungibile per `anon` e
-- `authenticated`: ci arriva solo il server con la chiave `service_role`, che
-- salta la RLS. E' il punto: una cache condivisa scrivibile dai client si
-- avvelena: basta un utente che inserisce comparabili inventati per spostare
-- le valutazioni di tutti gli altri. Qui il numero e' il prodotto, quindi la
-- superficie di scrittura resta chiusa.
--
-- Le letture passano comunque dal server, che gia' interroga il modello: non
-- serve esporre la tabella al browser.

revoke all on public.market_research_cache from anon, authenticated;

comment on table public.market_research_cache is
  'Ricerche di mercato riusabili per modello. Scritta e letta solo da service_role.';
