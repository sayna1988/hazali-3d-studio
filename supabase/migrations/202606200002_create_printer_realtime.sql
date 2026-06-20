create table if not exists public.printer_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Mijn printer',
  local_ip text,
  remote_url text,
  camera_url text,
  ingest_token uuid not null default gen_random_uuid() unique,
  updated_at timestamptz not null default now()
);

create table if not exists public.printer_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

alter table public.printer_devices enable row level security;
alter table public.printer_status enable row level security;

create policy "Users can read own printer device" on public.printer_devices
  for select using (auth.uid() = user_id);
create policy "Users can insert own printer device" on public.printer_devices
  for insert with check (auth.uid() = user_id);
create policy "Users can update own printer device" on public.printer_devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read own printer status" on public.printer_status
  for select using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.printer_status;
exception
  when duplicate_object then null;
end $$;
