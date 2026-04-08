CREATE OR REPLACE FUNCTION public.get_session_summary(p_session_id uuid)
 RETURNS TABLE(total_trials bigint, accuracy numeric, avg_rt_ms integer, median_rt_ms integer, avg_cue_level numeric, cue_reduction numeric, start_difficulty integer, end_difficulty integer, error_breakdown jsonb, timeout_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  first_level INTEGER;
  last_level INTEGER;
  first_half_cues NUMERIC;
  second_half_cues NUMERIC;
BEGIN
  -- Get difficulty progression (fix: use -> then ->> for nested jsonb)
  SELECT (inputs->'task_params'->>'difficulty_level')::INTEGER
  INTO first_level
  FROM exercise_events
  WHERE session_id = p_session_id
  ORDER BY created_at ASC
  LIMIT 1;
  
  SELECT (inputs->'task_params'->>'difficulty_level')::INTEGER
  INTO last_level
  FROM exercise_events
  WHERE session_id = p_session_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Calculate cue reduction (first half vs second half)
  WITH trial_order AS (
    SELECT 
      cue_level,
      ROW_NUMBER() OVER (ORDER BY created_at) as rn,
      COUNT(*) OVER () as total
    FROM exercise_events
    WHERE session_id = p_session_id
  )
  SELECT 
    AVG(CASE WHEN rn <= total/2 THEN cue_level ELSE NULL END),
    AVG(CASE WHEN rn > total/2 THEN cue_level ELSE NULL END)
  INTO first_half_cues, second_half_cues
  FROM trial_order;
  
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_trials,
    COALESCE(AVG(CASE WHEN score > 0 THEN 1.0 ELSE 0.0 END), 0) as accuracy,
    COALESCE(AVG(reaction_time_ms)::INTEGER, 0) as avg_rt_ms,
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY reaction_time_ms)::INTEGER, 0) as median_rt_ms,
    COALESCE(AVG(cue_level), 0) as avg_cue_level,
    COALESCE(first_half_cues - second_half_cues, 0) as cue_reduction,
    COALESCE(first_level, 1) as start_difficulty,
    COALESCE(last_level, 1) as end_difficulty,
    jsonb_build_object(
      'semantic_related', COUNT(*) FILTER (WHERE error_type = 'semantic_related'),
      'timeout', COUNT(*) FILTER (WHERE error_type = 'timeout'),
      'unrelated', COUNT(*) FILTER (WHERE error_type = 'unrelated')
    ) as error_breakdown,
    COUNT(*) FILTER (WHERE error_type = 'timeout')::BIGINT as timeout_count
  FROM exercise_events
  WHERE session_id = p_session_id;
END;
$function$;