create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.deal_retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null,
  country_code char(2) not null default 'NL',
  active boolean not null default true,
  adapter_type text not null,
  last_successful_check_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_retailers_adapter_type_check check (adapter_type in ('api', 'product_feed', 'affiliate_feed', 'html')),
  constraint deal_retailers_domain_check check (length(trim(domain)) > 0),
  constraint deal_retailers_config_object_check check (jsonb_typeof(config) = 'object')
);

create unique index if not exists deal_retailers_domain_key
  on public.deal_retailers (lower(domain));

create index if not exists deal_retailers_active_idx
  on public.deal_retailers (active);

drop trigger if exists set_deal_retailers_updated_at on public.deal_retailers;
create trigger set_deal_retailers_updated_at
  before update on public.deal_retailers
  for each row execute function public.set_updated_at();

create table if not exists public.deal_products (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.deal_retailers(id) on delete cascade,
  source_id text not null,
  product_name text not null,
  brand text not null,
  material text not null,
  product_url text not null,
  image_url text,
  diameter_mm numeric(4,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_products_source_id_check check (length(trim(source_id)) > 0),
  constraint deal_products_product_name_check check (length(trim(product_name)) > 0),
  constraint deal_products_brand_check check (length(trim(brand)) > 0),
  constraint deal_products_material_check check (length(trim(material)) > 0),
  constraint deal_products_product_url_check check (product_url ~* '^https?://'),
  constraint deal_products_image_url_check check (image_url is null or image_url ~* '^https?://'),
  constraint deal_products_diameter_check check (diameter_mm is null or diameter_mm > 0)
);

create unique index if not exists deal_products_retailer_source_key
  on public.deal_products (retailer_id, source_id);

create unique index if not exists deal_products_retailer_url_key
  on public.deal_products (retailer_id, lower(product_url));

create index if not exists deal_products_material_idx
  on public.deal_products (material);

create index if not exists deal_products_brand_idx
  on public.deal_products (brand);

create index if not exists deal_products_active_idx
  on public.deal_products (active);

drop trigger if exists set_deal_products_updated_at on public.deal_products;
create trigger set_deal_products_updated_at
  before update on public.deal_products
  for each row execute function public.set_updated_at();

create table if not exists public.deal_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.deal_products(id) on delete cascade,
  variant_key text not null,
  variant_source_id text,
  sku text,
  color text not null,
  spool_weight_grams integer not null,
  spool_count integer not null default 1,
  total_weight_grams integer generated always as (spool_weight_grams * spool_count) stored,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_product_variants_variant_key_check check (length(trim(variant_key)) > 0),
  constraint deal_product_variants_color_check check (length(trim(color)) > 0),
  constraint deal_product_variants_spool_weight_check check (spool_weight_grams > 0),
  constraint deal_product_variants_spool_count_check check (spool_count > 0)
);

create unique index if not exists deal_product_variants_product_variant_key
  on public.deal_product_variants (product_id, variant_key);

create unique index if not exists deal_product_variants_product_source_key
  on public.deal_product_variants (product_id, variant_source_id)
  where variant_source_id is not null;

create index if not exists deal_product_variants_product_idx
  on public.deal_product_variants (product_id);

create index if not exists deal_product_variants_weight_idx
  on public.deal_product_variants (total_weight_grams);

drop trigger if exists set_deal_product_variants_updated_at on public.deal_product_variants;
create trigger set_deal_product_variants_updated_at
  before update on public.deal_product_variants
  for each row execute function public.set_updated_at();

create table if not exists public.deal_offers (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.deal_product_variants(id) on delete cascade,
  product_price numeric(12,2) not null,
  normal_price numeric(12,2),
  direct_discount numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  total_price numeric(12,2) not null,
  price_per_kg numeric(12,2) not null,
  currency char(3) not null default 'EUR',
  stock_status text not null default 'unknown',
  checked_at timestamptz not null,
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_offers_prices_check check (
    product_price >= 0
    and (normal_price is null or normal_price >= 0)
    and direct_discount >= 0
    and shipping_cost >= 0
    and total_price >= 0
    and price_per_kg >= 0
  ),
  constraint deal_offers_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint deal_offers_stock_status_check check (stock_status in ('in_stock', 'out_of_stock', 'backorder', 'preorder', 'unknown'))
);

create unique index if not exists deal_offers_variant_key
  on public.deal_offers (variant_id);

create index if not exists deal_offers_price_per_kg_idx
  on public.deal_offers (price_per_kg);

create index if not exists deal_offers_stock_checked_idx
  on public.deal_offers (stock_status, checked_at desc);

drop trigger if exists set_deal_offers_updated_at on public.deal_offers;
create trigger set_deal_offers_updated_at
  before update on public.deal_offers
  for each row execute function public.set_updated_at();

create table if not exists public.deal_price_observations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.deal_offers(id) on delete cascade,
  product_price numeric(12,2) not null,
  normal_price numeric(12,2),
  direct_discount numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  total_price numeric(12,2) not null,
  price_per_kg numeric(12,2) not null,
  currency char(3) not null default 'EUR',
  stock_status text not null default 'unknown',
  checked_at timestamptz not null,
  observation_hash text not null,
  created_at timestamptz not null default now(),
  constraint deal_price_observations_prices_check check (
    product_price >= 0
    and (normal_price is null or normal_price >= 0)
    and direct_discount >= 0
    and shipping_cost >= 0
    and total_price >= 0
    and price_per_kg >= 0
  ),
  constraint deal_price_observations_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint deal_price_observations_stock_status_check check (stock_status in ('in_stock', 'out_of_stock', 'backorder', 'preorder', 'unknown'))
);

create unique index if not exists deal_price_observations_offer_hash_key
  on public.deal_price_observations (offer_id, observation_hash);

create unique index if not exists deal_price_observations_offer_checked_key
  on public.deal_price_observations (offer_id, checked_at);

create index if not exists deal_price_observations_offer_checked_idx
  on public.deal_price_observations (offer_id, checked_at desc);

create table if not exists public.deal_tracker_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material text not null,
  brand text,
  retailer_id uuid references public.deal_retailers(id) on delete set null,
  max_price_per_kg numeric(12,2) not null,
  min_spool_weight_grams integer not null default 750,
  in_stock_only boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_tracker_rules_material_check check (length(trim(material)) > 0),
  constraint deal_tracker_rules_max_price_check check (max_price_per_kg > 0),
  constraint deal_tracker_rules_min_spool_weight_check check (min_spool_weight_grams >= 0)
);

create index if not exists deal_tracker_rules_user_active_idx
  on public.deal_tracker_rules (user_id, active);

create index if not exists deal_tracker_rules_retailer_idx
  on public.deal_tracker_rules (retailer_id);

drop trigger if exists set_deal_tracker_rules_updated_at on public.deal_tracker_rules;
create trigger set_deal_tracker_rules_updated_at
  before update on public.deal_tracker_rules
  for each row execute function public.set_updated_at();

create table if not exists public.deal_scrape_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  trigger_source text not null default 'scheduled',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  retailers_total integer not null default 0,
  retailers_succeeded integer not null default 0,
  retailers_failed integer not null default 0,
  offers_seen integer not null default 0,
  observations_inserted integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_scrape_runs_status_check check (status in ('running', 'succeeded', 'partial_failed', 'failed')),
  constraint deal_scrape_runs_counts_check check (
    retailers_total >= 0
    and retailers_succeeded >= 0
    and retailers_failed >= 0
    and offers_seen >= 0
    and observations_inserted >= 0
  )
);

create index if not exists deal_scrape_runs_started_idx
  on public.deal_scrape_runs (started_at desc);

create index if not exists deal_scrape_runs_status_idx
  on public.deal_scrape_runs (status);

drop trigger if exists set_deal_scrape_runs_updated_at on public.deal_scrape_runs;
create trigger set_deal_scrape_runs_updated_at
  before update on public.deal_scrape_runs
  for each row execute function public.set_updated_at();

create table if not exists public.deal_scrape_run_errors (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.deal_scrape_runs(id) on delete cascade,
  retailer_id uuid references public.deal_retailers(id) on delete set null,
  adapter_key text not null,
  error_code text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint deal_scrape_run_errors_adapter_key_check check (length(trim(adapter_key)) > 0),
  constraint deal_scrape_run_errors_error_code_check check (length(trim(error_code)) > 0),
  constraint deal_scrape_run_errors_message_check check (length(trim(message)) > 0),
  constraint deal_scrape_run_errors_details_object_check check (jsonb_typeof(details) = 'object')
);

create index if not exists deal_scrape_run_errors_run_idx
  on public.deal_scrape_run_errors (run_id);

create index if not exists deal_scrape_run_errors_retailer_idx
  on public.deal_scrape_run_errors (retailer_id);

create table if not exists public.deal_alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracker_rule_id uuid not null references public.deal_tracker_rules(id) on delete cascade,
  offer_id uuid not null references public.deal_offers(id) on delete cascade,
  price_observation_id uuid references public.deal_price_observations(id) on delete set null,
  event_key text not null,
  price_per_kg numeric(12,2) not null,
  notification_status text not null default 'pending',
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  constraint deal_alert_events_event_key_check check (length(trim(event_key)) > 0),
  constraint deal_alert_events_price_check check (price_per_kg >= 0),
  constraint deal_alert_events_notification_status_check check (notification_status in ('pending', 'sent', 'failed', 'skipped'))
);

create unique index if not exists deal_alert_events_user_event_key
  on public.deal_alert_events (user_id, event_key);

create index if not exists deal_alert_events_user_created_idx
  on public.deal_alert_events (user_id, created_at desc);

create index if not exists deal_alert_events_rule_idx
  on public.deal_alert_events (tracker_rule_id);

alter table public.deal_retailers enable row level security;
alter table public.deal_products enable row level security;
alter table public.deal_product_variants enable row level security;
alter table public.deal_offers enable row level security;
alter table public.deal_price_observations enable row level security;
alter table public.deal_tracker_rules enable row level security;
alter table public.deal_scrape_runs enable row level security;
alter table public.deal_scrape_run_errors enable row level security;
alter table public.deal_alert_events enable row level security;

drop policy if exists "Authenticated users can read deal retailers" on public.deal_retailers;
create policy "Authenticated users can read deal retailers"
  on public.deal_retailers for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read deal products" on public.deal_products;
create policy "Authenticated users can read deal products"
  on public.deal_products for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read deal product variants" on public.deal_product_variants;
create policy "Authenticated users can read deal product variants"
  on public.deal_product_variants for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read deal offers" on public.deal_offers;
create policy "Authenticated users can read deal offers"
  on public.deal_offers for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read deal price observations" on public.deal_price_observations;
create policy "Authenticated users can read deal price observations"
  on public.deal_price_observations for select
  to authenticated
  using (true);

drop policy if exists "Users can read own deal tracker rules" on public.deal_tracker_rules;
create policy "Users can read own deal tracker rules"
  on public.deal_tracker_rules for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own deal tracker rules" on public.deal_tracker_rules;
create policy "Users can insert own deal tracker rules"
  on public.deal_tracker_rules for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own deal tracker rules" on public.deal_tracker_rules;
create policy "Users can update own deal tracker rules"
  on public.deal_tracker_rules for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own deal tracker rules" on public.deal_tracker_rules;
create policy "Users can delete own deal tracker rules"
  on public.deal_tracker_rules for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own deal alert events" on public.deal_alert_events;
create policy "Users can read own deal alert events"
  on public.deal_alert_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own deal alert events" on public.deal_alert_events;
create policy "Users can update own deal alert events"
  on public.deal_alert_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.deal_retailers is 'Filament dealtracker retailers. Config must not contain secrets.';
comment on table public.deal_products is 'Normalized filament products per retailer.';
comment on table public.deal_product_variants is 'Normalized filament product variants, including spool and multipack weight.';
comment on table public.deal_offers is 'Current/latest offer state per product variant.';
comment on table public.deal_price_observations is 'Historical offer observations for price history and deduplication.';
comment on table public.deal_tracker_rules is 'User-owned filament deal alert rules.';
comment on table public.deal_scrape_runs is 'Service-owned scrape run summaries.';
comment on table public.deal_scrape_run_errors is 'Service-owned scrape run errors without secrets.';
comment on table public.deal_alert_events is 'User-visible alert events created by service processes.';
