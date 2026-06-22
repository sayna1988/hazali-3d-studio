create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "Users can read own app settings" on public.app_settings for select using (auth.uid() = user_id);
create policy "Users can insert own app settings" on public.app_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own app settings" on public.app_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.app_settings;
exception
  when duplicate_object then null;
end $$;
