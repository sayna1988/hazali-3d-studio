create extension if not exists pgcrypto;

create table if not exists public.prints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_key uuid not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists prints_user_client_key_idx on public.prints(user_id, client_key);

create index if not exists prints_user_id_idx on public.prints(user_id);
alter table public.prints enable row level security;

create policy "Users can read own prints" on public.prints for select using (auth.uid() = user_id);
create policy "Users can insert own prints" on public.prints for insert with check (auth.uid() = user_id);
create policy "Users can update own prints" on public.prints for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own prints" on public.prints for delete using (auth.uid() = user_id);
