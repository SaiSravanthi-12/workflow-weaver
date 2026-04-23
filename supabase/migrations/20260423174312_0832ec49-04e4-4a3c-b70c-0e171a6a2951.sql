-- Workflows table: each user owns a private library of workflow designs
create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  graph jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workflows_user_id_idx on public.workflows(user_id);
create index workflows_updated_at_idx on public.workflows(updated_at desc);

alter table public.workflows enable row level security;

create policy "Users view own workflows"
  on public.workflows for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own workflows"
  on public.workflows for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own workflows"
  on public.workflows for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own workflows"
  on public.workflows for delete
  to authenticated
  using (auth.uid() = user_id);

-- Auto-update updated_at on row changes
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workflows_set_updated_at
  before update on public.workflows
  for each row execute function public.set_updated_at();