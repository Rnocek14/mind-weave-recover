# Mastery Health Runbook

Daily snapshot of the mastery pipeline. Cron writes one row per metric per day to
`mastery_health_snapshots`. Threshold breaches land in `mastery_health_alerts`.
No external delivery yet — check the tables.

## Watch queries (first-week manual check)

```sql
-- 1. Latest snapshot per metric
select distinct on (metric_key) metric_key, metric_value, captured_at
from mastery_health_snapshots
order by metric_key, captured_at desc;
```
**What it tells you:** today's pipeline state at a glance.
**If off:** any `metric_value = 0` for `mastery_rows_24h` means the writer is broken — check `flushMasteryShadow` logs.

```sql
-- 2. 30-day trend per metric
select metric_key, date_trunc('day', captured_at) as day, avg(metric_value) as v
from mastery_health_snapshots
where captured_at >= now() - interval '30 days'
group by 1, 2 order by 1, 2;
```
**What it tells you:** whether the pipeline is steady or drifting.
**If off:** a sudden cliff in `mastery_rows_24h` aligns with a deploy → revert. A creeping `naming_unspecified_pct` means slug routing is leaking.

```sql
-- 3. Unacknowledged alerts
select fired_at, severity, alert_key, metric_value, threshold_value, context
from mastery_health_alerts
where acknowledged_at is null
order by severity, fired_at desc;
```
**What it tells you:** what the cron flagged.
**If off:** `severity = 'page'` means act now. `notify` is FYI; review during weekly check-in.

```sql
-- 4. Sessions-vs-mastery cross-check (live, not snapshot)
select * from v_sessions_logs_vs_mastery_24h;
```
**What it tells you:** how many sessions logged trials vs how many produced mastery rows.
**If off:** large gap = trials are flowing but the writer isn't producing rows. Inspect `flushMasteryShadow` and the slug routing layer.

## Alert reference

| key | severity | meaning |
|---|---|---|
| `mastery_rows_24h_zero` | page | No mastery rows updated in 24h. Writer is silent. Day-1 active. |
| `mastery_rows_24h_below_half_trailing_avg` | notify | Volume dropped > 50% vs 7-day avg. Active day 8+. |
| `naming_unspecified_pct_2x_trailing_median` | notify | Naming routing is leaking to fallback bucket. Active day 8+. |

## Acknowledge an alert

```sql
update mastery_health_alerts
   set acknowledged_at = now(), acknowledged_by = auth.uid()
 where id = '<alert-id>';
```

## Known gaps

- **Cron auth model.** `pg_cron` → `pg_net` invokes the edge function with the
  anon key. The function then uses `SUPABASE_SERVICE_ROLE_KEY` server-side to
  read the views and write snapshots/alerts. The pg_net request carries no JWT
  user context, so `auth.uid()` is `null` inside any RLS check evaluated on the
  cron path. **Do not add RLS `INSERT` policies that check `auth.uid()` on
  `mastery_health_snapshots` or `mastery_health_alerts`** — the cron will
  silently fail. Current policies (admin-only `SELECT`, no client write) are
  correct; keep it that way.
- `telemetry_write_failures_24h` reads from `adaptation_anomalies` but the
  writer in `useAdaptationTrialLogger` currently inserts into `exercise_events`
  with a non-existent `event_type` column (suppressed by `as any`). Metric will
  read 0 until the follow-up ticket lands. Required fix:
  - Change target table from `exercise_events` to `adaptation_anomalies`.
  - Reshape insert to `{ user_id, session_id, exercise_slug, trial_index: -1,
    anomaly_type: 'telemetry_write_failure', severity: 'warn',
    detail: '<N> consecutive flush failures',
    evidence: { consecutive_failures } }`.
  - Remove the `as any` casts so the type checker catches future drift.
  - Verify the view's `where anomaly_type = 'telemetry_write_failure'` filter
    matches the new writer.
- Cross-check view's `sessions_that_produced_mastery_24h` is a user-level
  approximation, not strict per-session. Adequate for trend, not for forensic
  attribution.
