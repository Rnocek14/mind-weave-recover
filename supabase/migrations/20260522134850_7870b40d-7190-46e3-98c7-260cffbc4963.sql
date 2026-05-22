create table if not exists public.qa_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  build_sha text,
  role text,
  device_label text,
  scenario_id text not null,
  step_id text not null,
  result text not null check (result in ('pass', 'fail', 'skip')),
  note text,
  recorded_at timestamptz not null default now()
);

create index if not exists qa_runs_build_role_idx
  on public.qa_runs (build_sha, role);

create index if not exists qa_runs_user_recorded_idx
  on public.qa_runs (user_id, recorded_at desc);

alter table public.qa_runs enable row level security;

create policy "qa_runs_select_own"
  on public.qa_runs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "qa_runs_insert_own"
  on public.qa_runs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "qa_runs_delete_own"
  on public.qa_runs for delete
  to authenticated
  using (auth.uid() = user_id);