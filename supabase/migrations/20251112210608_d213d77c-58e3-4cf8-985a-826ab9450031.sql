-- Create RPC function to get exercise stats for last 7 days
CREATE OR REPLACE FUNCTION public.get_exercise_stats_last7d(
  uid UUID, 
  slug TEXT
)
RETURNS TABLE (
  avg_accuracy NUMERIC,
  median_rt INTEGER,
  trial_count BIGINT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(AVG(CASE WHEN e.score > 0 THEN 1.0 ELSE 0.0 END), 0) AS avg_accuracy,
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY e.reaction_time_ms), 0)::INTEGER AS median_rt,
    COUNT(*)::BIGINT AS trial_count
  FROM exercise_events e
  JOIN sessions s ON s.id = e.session_id
  WHERE s.user_id = uid
    AND e.exercise_slug = slug
    AND s.started_at > now() - interval '7 days'
    AND e.reaction_time_ms IS NOT NULL;
END;
$$;