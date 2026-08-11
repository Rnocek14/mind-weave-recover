-- Per-user fixed-window rate limiting for expensive edge functions.
--
-- No rate limiting existed anywhere: any authenticated user could loop the
-- Gemini/OpenAI/ElevenLabs/Azure endpoints without bound. This adds a
-- service-role-only counter table plus an atomic check-and-increment RPC.
-- Limits are enforced in the edge functions via _shared/rateLimit.ts.

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket, window_start)
);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) touches this table.

-- Atomic fixed-window check-and-increment. Returns TRUE when the call is
-- allowed (and counted), FALSE when the caller is over the limit.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid,
  _bucket text,
  _max integer,
  _window_seconds integer DEFAULT 3600
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz;
  _count integer;
BEGIN
  _window_start := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.rate_limit_counters (user_id, bucket, window_start, count)
  VALUES (_user_id, _bucket, _window_start, 1)
  ON CONFLICT (user_id, bucket, window_start)
  DO UPDATE SET count = rate_limit_counters.count + 1
  RETURNING count INTO _count;

  RETURN _count <= _max;
END;
$$;

-- Service-role only — this is not a client-callable RPC.
REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO service_role;

-- Housekeeping: old windows are garbage. Clean opportunistically on a
-- weekly cron if pg_cron is present; harmless if this block no-ops.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'rate-limit-counter-cleanup-weekly',
      '0 4 * * 0',
      $sql$DELETE FROM public.rate_limit_counters WHERE window_start < now() - interval '2 days'$sql$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- cron scheduling is best-effort
END $$;
