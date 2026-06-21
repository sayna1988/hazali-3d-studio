create table if not exists public.filaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_key uuid not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists filaments_user_client_key_idx on public.filaments(user_id, client_key);
create index if not exists filaments_user_id_idx on public.filaments(user_id);

alter table public.filaments enable row level security;

create policy "Users can read own filaments" on public.filaments for select using (auth.uid() = user_id);
create policy "Users can insert own filaments" on public.filaments for insert with check (auth.uid() = user_id);
create policy "Users can update own filaments" on public.filaments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own filaments" on public.filaments for delete using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.filaments;
exception
  when duplicate_object then null;
end $$;
