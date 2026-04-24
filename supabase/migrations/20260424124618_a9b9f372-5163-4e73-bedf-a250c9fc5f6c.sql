-- 0. Expand allowed ended_reason values to match what the code/sweeper writes.
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_ended_reason_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_ended_reason_check
  CHECK (
    ended_reason IS NULL OR ended_reason = ANY (ARRAY[
      'completed'::text,
      'abandoned'::text,
      'skipped'::text,
      'pagehide'::text,
      'visibility_timeout'::text,
      'unmount'::text,
      'manual'::text,
      'timeout_sweep'::text
    ])
  );

-- 1. Backfill: previously-closed sessions with no reason → 'completed'
UPDATE public.sessions
SET ended_reason = 'completed'
WHERE ended_at IS NOT NULL AND ended_reason IS NULL;

-- 2. Backfill: still-open sessions older than 2h → 'timeout_sweep'
UPDATE public.sessions
SET ended_at = COALESCE(ended_at, started_at + interval '5 minutes'),
    ended_reason = 'timeout_sweep',
    duration_sec = COALESCE(duration_sec, 300)
WHERE ended_at IS NULL
  AND started_at < now() - interval '2 hours';

-- 3. Schedule the sweeper edge function to run every 10 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'sweep-stale-sessions-10min';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'sweep-stale-sessions-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wjedbpjaiqdxhmjzkcxo.supabase.co/functions/v1/sweep-stale-sessions',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"thresholdMinutes": 30}'::jsonb
  );
  $$
);