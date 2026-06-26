create table if not exists public.print_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.print_queue enable row level security;

create policy "Users can read own print queue" on public.print_queue for select using (auth.uid() = user_id);
create policy "Users can insert own print queue" on public.print_queue for insert with check (auth.uid() = user_id);
create policy "Users can update own print queue" on public.print_queue for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.print_queue;
exception
  when duplicate_object then null;
end $$;
