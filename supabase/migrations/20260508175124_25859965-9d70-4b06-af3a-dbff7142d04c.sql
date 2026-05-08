-- =========================================================================
-- Mastery health observability: append-only snapshots + alerts (Channel D)
-- Narrow EAV shape (one row per metric per snapshot). No external delivery.
-- =========================================================================

-- 1. Snapshot table — append-only, admin-read.
create table public.mastery_health_snapshots (
  id           uuid primary key default gen_random_uuid(),
  captured_at  timestamptz not null default now(),
  metric_key   text not null,
  metric_value numeric,            -- NULL = metric undefined (e.g. ratio over 0)
  metadata     jsonb               -- nullable: window bounds, sample size, query version
);

create index mastery_health_snapshots_key_time_idx
  on public.mastery_health_snapshots (metric_key, captured_at desc);

alter table public.mastery_health_snapshots enable row level security;

create policy "Admins read mastery health snapshots"
  on public.mastery_health_snapshots
  for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies. The cron edge function writes via service role.

-- 2. Alert table — page-vs-notify is a column, not a delivery channel.
create table public.mastery_health_alerts (
  id              uuid primary key default gen_random_uuid(),
  fired_at        timestamptz not null default now(),
  alert_key       text not null,                  -- e.g. 'mastery_rows_24h_zero'
  severity        text not null check (severity in ('page','notify')),
  metric_key      text not null,
  metric_value    numeric,
  threshold_value numeric,                        -- nullable: NA for absence alerts
  context         jsonb,                          -- baseline window, sample size, etc.
  acknowledged_at timestamptz,
  acknowledged_by uuid
);

create index mastery_health_alerts_unack_idx
  on public.mastery_health_alerts (severity, fired_at desc)
  where acknowledged_at is null;

alter table public.mastery_health_alerts enable row level security;

create policy "Admins read mastery health alerts"
  on public.mastery_health_alerts
  for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins acknowledge mastery health alerts"
  on public.mastery_health_alerts
  for update
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

-- 3. View — primary 24h metrics. Plain. No window functions, no recursion.
--    Returns one row per metric_key for direct insertion into snapshots.
create or replace view public.v_mastery_health_24h as
with
  rows_24h as (
    select count(*)::numeric as n
    from public.user_skill_mastery
    where last_practiced_at >= now() - interval '24 hours'
  ),
  naming_24h as (
    select
      count(*) filter (where skill_slug = 'naming.unspecified')::numeric as unspec,
      count(*) filter (where skill_slug like 'naming.%')::numeric        as total
    from public.user_skill_mastery
    where last_practiced_at >= now() - interval '24 hours'
  ),
  failures_24h as (
    -- telemetry_write_failure events emitted by useAdaptationTrialLogger
    select count(*)::numeric as n
    from public.adaptation_anomalies
    where created_at >= now() - interval '24 hours'
      and anomaly_type = 'telemetry_write_failure'
  )
select 'mastery_rows_24h'::text as metric_key,
       n as metric_value,
       jsonb_build_object('source','user_skill_mastery','window','24h') as metadata
  from rows_24h
union all
select 'naming_unspecified_pct',
       case when total > 0 then round((unspec / total) * 100, 2) else null end,
       jsonb_build_object('numerator',unspec,'denominator',total,'source','user_skill_mastery')
  from naming_24h
union all
select 'telemetry_write_failures_24h',
       n,
       jsonb_build_object('source','adaptation_anomalies','anomaly_type','telemetry_write_failure')
  from failures_24h;

-- 4. Separate view for the sessions-vs-mastery cross-check (kept apart per "split when it gets clever").
create or replace view public.v_sessions_logs_vs_mastery_24h as
with
  sessions_with_logs as (
    select count(distinct session_id)::numeric as n
    from public.adaptation_trial_logs
    where created_at >= now() - interval '24 hours'
      and session_id is not null
  ),
  sessions_with_mastery as (
    -- A session "produced mastery" if any user_skill_mastery row was updated
    -- by a user who had trial logs in the same 24h window.
    -- Approximation: distinct users with both signals in the window.
    select count(distinct atl.user_id)::numeric as n
    from public.adaptation_trial_logs atl
    join public.user_skill_mastery usm
      on usm.user_id = atl.user_id
     and usm.last_practiced_at >= now() - interval '24 hours'
    where atl.created_at >= now() - interval '24 hours'
  )
select 'sessions_with_logs_24h'::text as metric_key,
       n as metric_value,
       jsonb_build_object('source','adaptation_trial_logs','distinct','session_id') as metadata
  from sessions_with_logs
union all
select 'sessions_that_produced_mastery_24h',
       n,
       jsonb_build_object('source','user_skill_mastery + adaptation_trial_logs','distinct','user_id','note','user-level approximation')
  from sessions_with_mastery;

grant select on public.v_mastery_health_24h to authenticated;
grant select on public.v_sessions_logs_vs_mastery_24h to authenticated;