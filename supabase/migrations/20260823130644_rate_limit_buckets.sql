-- Rate limit condiviso fra istanze.
--
-- Il limitatore precedente viveva in una Map in memoria: bastava per un solo
-- processo in sviluppo, ma su un'infrastruttura serverless ogni richiesta puo'
-- capitare su un'istanza diversa, ognuna con la propria Map vuota. Il limite
-- non falliva rumorosamente: smetteva semplicemente di contare, e nessuno se
-- ne sarebbe accorto finche' qualcuno non avesse scoperto di poter chiamare
-- l'API di analisi senza limiti.
--
-- Nessuna policy, come per market_research_cache: non e' un dato di un
-- utente, e' un contatore di sistema. Ci arriva solo il server con
-- service_role.

create table public.rate_limit_buckets (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from anon, authenticated;

comment on table public.rate_limit_buckets is
  'Contatori di rate limit, condivisi fra tutte le istanze del server. Scritta e letta solo da service_role.';

/**
 * Incrementa il contatore e decide se la richiesta passa, in una sola
 * istruzione atomica: con due richieste arrivate nello stesso istante su due
 * istanze diverse, l'UPSERT le serializza a livello di riga invece di farle
 * leggere lo stesso valore e incrementarlo entrambe da capo, che avrebbe
 * lasciato passare piu' richieste del limite dichiarato.
 *
 * SECURITY INVOKER, non DEFINER: l'unico chiamante e' service_role, che salta
 * gia' la RLS di suo. Un DEFINER qui aggiungerebbe privilegi senza motivo.
 */
create function public.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_ms bigint
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security invoker
as $$
declare
  v_count integer;
  v_reset_at timestamptz;
begin
  insert into public.rate_limit_buckets as b (key, count, reset_at)
  values (p_key, 1, now() + (p_window_ms || ' milliseconds')::interval)
  on conflict (key) do update
    set count = case when b.reset_at > now() then b.count + 1 else 1 end,
        reset_at = case when b.reset_at > now() then b.reset_at else now() + (p_window_ms || ' milliseconds')::interval end
  returning b.count, b.reset_at into v_count, v_reset_at;

  return query select
    v_count <= p_limit,
    greatest(0, ceil(extract(epoch from (v_reset_at - now())))::integer);
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, bigint) from public, anon, authenticated;

comment on function public.rate_limit_hit is
  'Incrementa e verifica un rate limit in un''unica operazione atomica. Solo service_role.';
