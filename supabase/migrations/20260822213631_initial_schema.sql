-- Schema iniziale di STYMA.
--
-- Un oggetto salvato (item) appartiene sempre a un utente, ha delle foto,
-- e conserva le valutazioni ricevute nel tempo con i comparabili su cui
-- ciascuna si basava. Le valutazioni sono immutabili: rianalizzare un oggetto
-- ne aggiunge una nuova invece di sovrascrivere la precedente, cosi' resta
-- leggibile come il mercato si e' mosso.

create type public.item_status as enum ('found', 'bought', 'listed', 'sold');
create type public.price_kind as enum ('sold', 'asking');
create type public.recommendation as enum ('BUY', 'MAYBE', 'PASS');

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  title text not null,
  category text,
  brand text,
  model text,
  description text,
  estimated_period text,
  condition text,
  identification_confidence numeric(3, 2) check (identification_confidence between 0 and 1),

  purchase_price numeric(10, 2) check (purchase_price >= 0),
  purchase_currency text not null default 'EUR',
  purchase_date date,
  purchase_location text,

  sale_price numeric(10, 2) check (sale_price >= 0),
  sale_date date,
  marketplace text,

  status public.item_status not null default 'found',
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_user_id_created_at_idx on public.items (user_id, created_at desc);

create table public.item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index item_images_item_id_sort_order_idx on public.item_images (item_id, sort_order);

create table public.valuations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,

  currency text not null default 'EUR',
  low_value numeric(10, 2),
  high_value numeric(10, 2),
  likely_value numeric(10, 2),

  -- Null quando i comparabili non bastavano: registriamo anche il non sapere.
  confidence text check (confidence in ('high', 'medium', 'low')),
  confidence_score numeric(4, 3) check (confidence_score between 0 and 1),

  flip_score smallint check (flip_score between 0 and 100),
  recommendation public.recommendation,
  assessed_at_price numeric(10, 2),

  -- Fattori del punteggio e motivi della confidenza, per mostrare il "perche'".
  reasoning jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint valuations_range_ordered check (
    low_value is null or high_value is null or low_value <= high_value
  )
);

create index valuations_item_id_created_at_idx on public.valuations (item_id, created_at desc);

create table public.comparables (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid not null references public.valuations (id) on delete cascade,

  title text not null,
  source text not null,
  url text not null,
  price numeric(10, 2) not null,
  currency text not null default 'EUR',
  kind public.price_kind not null,
  sold_at date,
  condition text,
  match_level text,
  -- Peso effettivo usato nel calcolo: rende la stima ricostruibile a posteriori.
  similarity_score numeric(4, 3),
  used boolean not null default true,
  discard_reason text,
  notes text,

  created_at timestamptz not null default now()
);

create index comparables_valuation_id_idx on public.comparables (valuation_id);

-- updated_at automatico sugli items.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_touch_updated_at
  before update on public.items
  for each row
  execute function public.touch_updated_at();

-- Row Level Security -------------------------------------------------------
-- Ogni tabella e' isolata per utente. Le tabelle figlie non hanno user_id:
-- la proprieta' si verifica risalendo all'item, cosi' non puo' divergere.

alter table public.items enable row level security;
alter table public.item_images enable row level security;
alter table public.valuations enable row level security;
alter table public.comparables enable row level security;

create policy "items are visible to their owner"
  on public.items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "items are created by their owner"
  on public.items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "items are updated by their owner"
  on public.items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "items are deleted by their owner"
  on public.items for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "item images follow their item"
  on public.item_images for all
  to authenticated
  using (
    exists (
      select 1 from public.items
      where items.id = item_images.item_id
        and items.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.items
      where items.id = item_images.item_id
        and items.user_id = (select auth.uid())
    )
  );

create policy "valuations follow their item"
  on public.valuations for all
  to authenticated
  using (
    exists (
      select 1 from public.items
      where items.id = valuations.item_id
        and items.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.items
      where items.id = valuations.item_id
        and items.user_id = (select auth.uid())
    )
  );

create policy "comparables follow their valuation"
  on public.comparables for all
  to authenticated
  using (
    exists (
      select 1
      from public.valuations
      join public.items on items.id = valuations.item_id
      where valuations.id = comparables.valuation_id
        and items.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.valuations
      join public.items on items.id = valuations.item_id
      where valuations.id = comparables.valuation_id
        and items.user_id = (select auth.uid())
    )
  );

-- Storage ------------------------------------------------------------------
-- Bucket privato. Le foto vivono sotto <user_id>/<item_id>/<file>, quindi
-- il primo segmento del path e' la chiave di proprieta'.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-images',
  'item-images',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

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
