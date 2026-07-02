create extension if not exists pgcrypto;

create table if not exists public.catalog_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_key uuid not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists catalog_folders_user_client_key_idx on public.catalog_folders(user_id, client_key);
create index if not exists catalog_folders_user_id_idx on public.catalog_folders(user_id);

alter table public.catalog_folders enable row level security;

drop policy if exists "Users can read own catalog folders" on public.catalog_folders;
drop policy if exists "Users can insert own catalog folders" on public.catalog_folders;
drop policy if exists "Users can update own catalog folders" on public.catalog_folders;
drop policy if exists "Users can delete own catalog folders" on public.catalog_folders;

create policy "Users can read own catalog folders" on public.catalog_folders for select using (auth.uid() = user_id);
create policy "Users can insert own catalog folders" on public.catalog_folders for insert with check (auth.uid() = user_id);
create policy "Users can update own catalog folders" on public.catalog_folders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own catalog folders" on public.catalog_folders for delete using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.catalog_folders;
exception
  when duplicate_object then null;
end $$;
