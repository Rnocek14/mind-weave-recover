UPDATE sessions
SET ended_at = now(),
    ended_reason = COALESCE(ended_reason, 'stale_auto_closed_backfill'),
    duration_sec = COALESCE(
      duration_sec,
      EXTRACT(epoch FROM (now() - COALESCE(started_at, now())))::integer
    )
WHERE ended_at IS NULL
  AND started_at < now() - interval '1 hour';