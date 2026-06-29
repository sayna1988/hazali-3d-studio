alter table public.deal_tracker_rules
  add column if not exists product_id uuid references public.deal_products(id) on delete cascade,
  add column if not exists min_total_weight_grams integer not null default 750,
  add column if not exists require_known_shipping boolean not null default true,
  add column if not exists last_triggered_at timestamptz,
  add column if not exists label text;

alter table public.deal_tracker_rules
  drop constraint if exists deal_tracker_rules_min_total_weight_check,
  add constraint deal_tracker_rules_min_total_weight_check check (min_total_weight_grams >= 0);

create index if not exists deal_tracker_rules_product_idx
  on public.deal_tracker_rules (product_id);

create index if not exists deal_tracker_rules_active_conditions_idx
  on public.deal_tracker_rules (active, material, retailer_id, product_id);

alter table public.deal_alert_events
  add column if not exists scrape_run_id uuid references public.deal_scrape_runs(id) on delete set null,
  add column if not exists reason text not null default 'Prijsalert geactiveerd.',
  add column if not exists previous_price_per_kg numeric(12,2),
  add column if not exists email_to text,
  add column if not exists email_subject text,
  add column if not exists email_error text,
  add column if not exists sent_at timestamptz;

create unique index if not exists deal_alert_events_run_rule_offer_key
  on public.deal_alert_events (scrape_run_id, tracker_rule_id, offer_id)
  where scrape_run_id is not null;

create index if not exists deal_alert_events_rule_created_idx
  on public.deal_alert_events (tracker_rule_id, created_at desc);

create index if not exists deal_alert_events_notification_idx
  on public.deal_alert_events (notification_status, created_at desc);
