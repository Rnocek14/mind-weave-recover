-- Auto-close sessions that have been left open for more than 4 hours.
-- Returns the number of sessions closed.
CREATE OR REPLACE FUNCTION public.close_stale_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_closed integer;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE sessions
  SET ended_at = now(),
      ended_reason = COALESCE(ended_reason, 'stale_auto_closed'),
      duration_sec = COALESCE(
        duration_sec,
        EXTRACT(epoch FROM (now() - COALESCE(started_at, now())))::integer
      )
  WHERE user_id = v_uid
    AND ended_at IS NULL
    AND started_at < now() - interval '4 hours';

  GET DIAGNOSTICS v_closed = ROW_COUNT;
  RETURN v_closed;
END;
$$;

-- Return the caller's most recent resumable session (open + started < 4h ago).
-- Returns at most one row.
CREATE OR REPLACE FUNCTION public.get_resumable_session()
RETURNS TABLE (
  id uuid,
  started_at timestamptz,
  plan jsonb,
  summary jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.started_at, s.plan, s.summary
  FROM sessions s
  WHERE s.user_id = auth.uid()
    AND s.ended_at IS NULL
    AND s.started_at >= now() - interval '4 hours'
    AND s.plan IS NOT NULL
    AND s.plan != '{}'::jsonb
  ORDER BY s.started_at DESC
  LIMIT 1;
$$;