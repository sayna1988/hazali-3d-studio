do $$
begin
  alter publication supabase_realtime add table public.prints;
exception
  when duplicate_object then null;
end $$;
