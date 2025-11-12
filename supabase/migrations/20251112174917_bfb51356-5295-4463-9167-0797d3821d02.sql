-- User profile with goals and accessibility
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  goals text[] default array[]::text[],
  accessibility_prefs jsonb default '{}'::jsonb,
  caregiver_mode_enabled boolean default false,
  daily_goal_minutes int default 20,
  hand_bias text default 'right' check (hand_bias in ('left', 'right', 'both')),
  consent_version int default 1,
  created_at timestamptz default now()
);

-- Storage bucket for photos (PRIVATE with signed URLs)
insert into storage.buckets (id, name, public) 
values ('photos', 'photos', false);

-- Photo metadata (storage_path points to private bucket)
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  name text not null,
  storage_path text not null,
  labels text[] default array[]::text[],
  created_at timestamptz default now()
);

-- Exercise definitions (pre-populated)
create table public.exercises (
  slug text primary key,
  title text not null,
  category text not null check (category in ('motor', 'speech', 'cognition')),
  metadata jsonb default '{}'::jsonb
);

-- Insert default exercises
insert into public.exercises (slug, title, category, metadata) values
  ('photo-naming', 'Name That Photo', 'speech', '{"icon": "image"}'),
  ('reach-tap', 'Reach & Tap', 'motor', '{"icon": "target"}');

-- Therapy sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_sec int,
  plan jsonb default '{}'::jsonb,
  summary jsonb default '{}'::jsonb
);

-- Individual exercise attempts
create table public.exercise_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade not null,
  exercise_slug text references public.exercises(slug),
  round int not null,
  inputs jsonb default '{}'::jsonb,
  outputs jsonb default '{}'::jsonb,
  score int,
  created_at timestamptz default now()
);

-- Achievement tracking (idempotent)
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  type text not null,
  value int,
  awarded_at timestamptz default now(),
  unique(user_id, type)
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.photos enable row level security;
alter table public.sessions enable row level security;
alter table public.exercise_events enable row level security;
alter table public.achievements enable row level security;
alter table public.exercises enable row level security;

-- RLS Policies: Users can only access their own data
create policy "Users access own profile" on public.profiles 
  for all using (auth.uid() = user_id);

create policy "Users access own photos" on public.photos 
  for all using (auth.uid() = user_id);

create policy "Users access own sessions" on public.sessions 
  for all using (auth.uid() = user_id);

create policy "Users access own events" on public.exercise_events 
  for all using (session_id in (select id from public.sessions where user_id = auth.uid()));

create policy "Users access own achievements" on public.achievements 
  for all using (auth.uid() = user_id);

create policy "Everyone can read exercises" on public.exercises
  for select using (true);

-- Storage RLS policies for PRIVATE photos bucket
create policy "Users upload to own folder" on storage.objects 
  for insert 
  with check (
    bucket_id = 'photos' 
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users read own folder" on storage.objects 
  for select 
  using (
    bucket_id = 'photos' 
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users update own folder" on storage.objects 
  for update 
  using (
    bucket_id = 'photos' 
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users delete own folder" on storage.objects 
  for delete 
  using (
    bucket_id = 'photos' 
    and auth.uid()::text = split_part(name, '/', 1)
  );

-- Helper function to create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'User'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();