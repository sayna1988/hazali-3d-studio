create table if not exists public.deal_scrape_locks (
  lock_name text primary key,
  run_id uuid references public.deal_scrape_runs(id) on delete set null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.deal_retailers
  add column if not exists adapter_key text,
  add column if not exists request_delay_ms integer not null default 1000,
  add column if not exists request_timeout_ms integer not null default 15000,
  add column if not exists max_concurrency integer not null default 3;

update public.deal_retailers
set adapter_key = case
  when lower(domain) in ('www.joybuy.nl', 'joybuy.nl') then 'joybuy-nl'
  else lower(regexp_replace(domain, '^www\.', ''))
end
where adapter_key is null;

alter table public.deal_retailers
  alter column adapter_key set not null;

alter table public.deal_retailers
  drop constraint if exists deal_retailers_request_delay_check,
  add constraint deal_retailers_request_delay_check check (request_delay_ms >= 0),
  drop constraint if exists deal_retailers_request_timeout_check,
  add constraint deal_retailers_request_timeout_check check (request_timeout_ms between 1000 and 60000),
  drop constraint if exists deal_retailers_max_concurrency_check,
  add constraint deal_retailers_max_concurrency_check check (max_concurrency between 1 and 3);

create index if not exists deal_retailers_adapter_key_idx
  on public.deal_retailers (adapter_key);

alter table public.deal_scrape_runs
  add column if not exists dry_run boolean not null default false,
  add column if not exists validate_only boolean not null default false,
  add column if not exists retailer_filter text,
  add column if not exists max_products integer,
  add column if not exists exit_code integer,
  add column if not exists exit_reason text;

alter table public.deal_scrape_runs
  drop constraint if exists deal_scrape_runs_status_check,
  add constraint deal_scrape_runs_status_check check (status in ('pending', 'running', 'completed', 'partial', 'failed'));

alter table public.deal_scrape_runs
  alter column status set default 'pending';

create table if not exists public.deal_scrape_run_retailers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.deal_scrape_runs(id) on delete cascade,
  retailer_id uuid references public.deal_retailers(id) on delete set null,
  adapter_key text not null,
  status text not null default 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer not null default 0,
  products_seen integer not null default 0,
  products_normalized integer not null default 0,
  variants_normalized integer not null default 0,
  offers_normalized integer not null default 0,
  duplicate_offers_skipped integer not null default 0,
  observations_inserted integer not null default 0,
  product_errors integer not null default 0,
  fatal_errors integer not null default 0,
  dry_run boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_scrape_run_retailers_status_check check (status in ('pending', 'running', 'completed', 'partial', 'failed', 'skipped')),
  constraint deal_scrape_run_retailers_counts_check check (
    duration_ms >= 0
    and products_seen >= 0
    and products_normalized >= 0
    and variants_normalized >= 0
    and offers_normalized >= 0
    and duplicate_offers_skipped >= 0
    and observations_inserted >= 0
    and product_errors >= 0
    and fatal_errors >= 0
  )
);

create unique index if not exists deal_scrape_run_retailers_run_adapter_key
  on public.deal_scrape_run_retailers (run_id, adapter_key);

create index if not exists deal_scrape_run_retailers_run_idx
  on public.deal_scrape_run_retailers (run_id);

drop trigger if exists set_deal_scrape_run_retailers_updated_at on public.deal_scrape_run_retailers;
create trigger set_deal_scrape_run_retailers_updated_at
  before update on public.deal_scrape_run_retailers
  for each row execute function public.set_updated_at();

alter table public.deal_offers
  add column if not exists shipping_cost_known boolean not null default true;

alter table public.deal_price_observations
  add column if not exists scrape_run_id uuid references public.deal_scrape_runs(id) on delete set null,
  add column if not exists shipping_cost_known boolean not null default true;

drop index if exists deal_price_observations_offer_hash_key;

create unique index if not exists deal_price_observations_run_offer_hash_key
  on public.deal_price_observations (scrape_run_id, offer_id, observation_hash)
  where scrape_run_id is not null;

alter table public.deal_scrape_locks enable row level security;
alter table public.deal_scrape_run_retailers enable row level security;

comment on table public.deal_scrape_locks is 'Service-owned locks to prevent concurrent dealtracker runs.';
comment on table public.deal_scrape_run_retailers is 'Per-retailer scrape run statistics.';
