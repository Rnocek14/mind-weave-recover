CREATE OR REPLACE FUNCTION public.get_exercise_stats_last7d(uid uuid, slug text, pid uuid DEFAULT NULL)
 RETURNS TABLE(avg_accuracy numeric, median_rt integer, trial_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND (pid IS NULL OR s.profile_id = pid)
    AND s.started_at > now() - interval '7 days'
    AND e.reaction_time_ms IS NOT NULL;
END;
$function$;