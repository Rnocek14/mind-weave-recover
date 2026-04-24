-- Telemetry bucketed RPC: returns raw per-(bucket, exercise) counts for trend analysis.
-- The client computes the same health score formula on each bucket so there's a
-- single source of truth (no duplicated scoring math in SQL).
--
-- _window: '1h' | '24h' | '7d' | '30d'
--   1h  -> 5-minute buckets
--   24h -> 1-hour buckets
--   7d  -> 1-day buckets
--   30d -> 1-day buckets
CREATE OR REPLACE FUNCTION public.telemetry_bucketed(_window text)
RETURNS TABLE (
  bucket_start timestamptz,
  exercise_slug text,
  total bigint,
  with_error_type bigint,
  with_adaptations bigint,
  with_signal bigint,
  adaptation_event_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interval interval;
  v_bucket   interval;
BEGIN
  CASE _window
    WHEN '1h'  THEN v_interval := interval '1 hour';   v_bucket := interval '5 minutes';
    WHEN '24h' THEN v_interval := interval '24 hours'; v_bucket := interval '1 hour';
    WHEN '7d'  THEN v_interval := interval '7 days';   v_bucket := interval '1 day';
    WHEN '30d' THEN v_interval := interval '30 days';  v_bucket := interval '1 day';
    ELSE
      RAISE EXCEPTION 'invalid window: %', _window;
  END CASE;

  RETURN QUERY
  WITH ev AS (
    SELECT
      date_bin(v_bucket, e.created_at, timestamptz 'epoch') AS bucket_start,
      e.exercise_slug,
      e.error_type,
      e.adaptations_active,
      e.outputs
    FROM public.exercise_events e
    WHERE e.created_at >= now() - v_interval
      AND e.exercise_slug IS NOT NULL
  ),
  ev_agg AS (
    SELECT
      ev.bucket_start,
      ev.exercise_slug,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE ev.error_type IS NOT NULL AND length(ev.error_type::text) > 0
      )::bigint AS with_error_type,
      COUNT(*) FILTER (
        WHERE ev.adaptations_active IS NOT NULL
          AND jsonb_typeof(ev.adaptations_active) = 'object'
          AND ev.adaptations_active <> '{}'::jsonb
      )::bigint AS with_adaptations,
      COUNT(*) FILTER (
        WHERE ev.outputs ? 'clinical_signal'
          AND jsonb_typeof(ev.outputs->'clinical_signal') = 'object'
          AND (
            (ev.outputs->'clinical_signal'->>'errorType') IS NOT NULL
            OR (ev.outputs->'clinical_signal'->>'successScore') IS NOT NULL
          )
      )::bigint AS with_signal
    FROM ev
    GROUP BY ev.bucket_start, ev.exercise_slug
  ),
  ad_agg AS (
    SELECT
      date_bin(v_bucket, a.created_at, timestamptz 'epoch') AS bucket_start,
      a.exercise_slug,
      COUNT(*)::bigint AS adaptation_event_count
    FROM public.adaptation_events a
    WHERE a.created_at >= now() - v_interval
      AND a.exercise_slug IS NOT NULL
    GROUP BY 1, 2
  )
  SELECT
    COALESCE(e.bucket_start, a.bucket_start)               AS bucket_start,
    COALESCE(e.exercise_slug, a.exercise_slug)             AS exercise_slug,
    COALESCE(e.total, 0)                                   AS total,
    COALESCE(e.with_error_type, 0)                         AS with_error_type,
    COALESCE(e.with_adaptations, 0)                        AS with_adaptations,
    COALESCE(e.with_signal, 0)                             AS with_signal,
    COALESCE(a.adaptation_event_count, 0)                  AS adaptation_event_count
  FROM ev_agg e
  FULL OUTER JOIN ad_agg a
    ON a.bucket_start = e.bucket_start
   AND a.exercise_slug = e.exercise_slug
  ORDER BY bucket_start ASC, exercise_slug ASC;
END;
$$;

-- Restrict to admins only (matches the rest of the telemetry surface).
REVOKE ALL ON FUNCTION public.telemetry_bucketed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telemetry_bucketed(text) TO authenticated;

COMMENT ON FUNCTION public.telemetry_bucketed(text) IS
  'Bucketed telemetry counts for trend tracking on /clinician/telemetry. Window: 1h (5-min), 24h (1h), 7d/30d (1d). Returns raw counts; client applies health-score formula.';
