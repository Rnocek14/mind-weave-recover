-- P0 #87. Correct the patient-visible clinical session-summary RPC without
-- changing persisted trial scores, progression rules, or historic sessions.
--
-- Migration target: controlled synthetic-only staging first. Production is
-- NOT touched by creating or reviewing this file.
--
-- Definitions:
--   accuracy = round(mean of canonical scorable 0..100 task scores, 1) / 100
--   (RPC fraction; not speech-recognition quality and not a binary pass rate).
--   total_trials = participation/event rows including invalid diagnostic rows.
--   valid_trials = canonical scored rows, excluding manually confirmed and
--   quarantined conversation / voice-practice slugs.
--   Missing timing, cues, accuracy, and difficulty remain SQL NULL.
--   Difficulty is *exercise* metadata, not clinical L1-L8 progression.
--
-- Preserve the existing signature and ownership-scoped SECURITY DEFINER
-- contract. Empty search_path prevents untrusted relation shadowing.
-- Explicit grants prevent anonymous execution.
CREATE OR REPLACE FUNCTION public.get_session_summary(p_session_id uuid)
RETURNS TABLE(
  total_trials bigint,
  accuracy numeric,
  avg_rt_ms integer,
  median_rt_ms integer,
  avg_cue_level numeric,
  cue_reduction numeric,
  start_difficulty integer,
  end_difficulty integer,
  error_breakdown jsonb,
  timeout_count bigint,
  valid_trials bigint,
  filler_count bigint,
  no_response_count bigint,
  background_noise_count bigint,
  flagged_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_session_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.sessions AS s
    WHERE s.id = p_session_id
      AND private.can_access_stroke_patient(s.user_id, s.profile_id, true)
  ) THEN
    RAISE EXCEPTION 'Not authorized to view session summary'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT
      e.id, e.round, e.created_at, e.score, e.reaction_time_ms,
      e.cue_level, e.error_type,
      -- Current persistence uses task_parameters and outputs.task_params.
      -- Never read the obsolete inputs.task_params fallback when current
      -- evidence exists; invalid/empty values do not invent a level.
      CASE
        WHEN d.raw_level ~ '^[0-9]{1,6}$' THEN d.raw_level::integer
        ELSE NULL::integer
      END AS measured_level
    FROM public.exercise_events AS e
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(e.task_parameters ->> 'difficulty_level', ''),
        NULLIF(e.outputs -> 'task_params' ->> 'difficulty_level', ''),
        NULLIF(e.outputs ->> 'difficulty_level', '')
      ) AS raw_level
    ) AS d
    WHERE e.session_id = p_session_id
      AND e.score IS NOT NULL
      AND e.counts_toward_score IS NOT FALSE
      AND e.validity_label IS DISTINCT FROM 'manual_confirmed'
      AND (e.exercise_slug IS NULL OR e.exercise_slug NOT IN (
        'conversation_partner', 'conversation_coach', 'conversation_turn',
        'voice_practice'
      ))
  ),
  ordered AS (
    SELECT
      e.*,
      ROW_NUMBER() OVER (ORDER BY e.created_at ASC NULLS LAST, e.round ASC, e.id ASC) AS rn,
      COUNT(*) OVER () AS scored_count
    FROM eligible AS e
  ),
  stats AS (
    SELECT
      ROUND(AVG(e.score), 1) / 100::numeric AS task_fraction,
      ROUND(AVG(e.reaction_time_ms) FILTER (
        WHERE e.reaction_time_ms >= 0
      ))::integer AS measured_avg_rt,
      (PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY e.reaction_time_ms
      ) FILTER (WHERE e.reaction_time_ms >= 0))::integer AS measured_median_rt,
      AVG(e.cue_level) FILTER (
        WHERE e.cue_level >= 0
      ) AS measured_avg_cue,
      (
        AVG(e.cue_level) FILTER (
          WHERE e.rn <= e.scored_count / 2 AND e.cue_level >= 0
        )
        - AVG(e.cue_level) FILTER (
          WHERE e.rn > e.scored_count / 2 AND e.cue_level >= 0
        )
      ) AS measured_cue_reduction,
      COUNT(*)::bigint AS scored_count,
      COUNT(*) FILTER (WHERE e.error_type = 'semantic_related')::bigint AS semantic_errors,
      COUNT(*) FILTER (WHERE e.error_type = 'timeout')::bigint AS timeouts,
      COUNT(*) FILTER (WHERE e.error_type = 'unrelated')::bigint AS unrelated_errors
    FROM ordered AS e
  ),
  all_events AS (
    SELECT
      COUNT(*)::bigint AS participation_count,
      COUNT(*) FILTER (WHERE e.validity_label = 'filler_only')::bigint AS filler_count,
      COUNT(*) FILTER (WHERE e.validity_label = 'no_response')::bigint AS no_response_count,
      COUNT(*) FILTER (WHERE e.validity_label = 'background_noise')::bigint AS background_noise_count,
      COUNT(*) FILTER (
        WHERE e.validity_label IN ('low_confidence', 'other_speaker_suspected')
      )::bigint AS flagged_count
    FROM public.exercise_events AS e
    WHERE e.session_id = p_session_id
  ),
  levels AS (
    SELECT
      (SELECT e.measured_level FROM eligible AS e
       WHERE e.measured_level IS NOT NULL
       ORDER BY e.created_at ASC NULLS LAST, e.round ASC, e.id ASC
       LIMIT 1) AS beginning,
      (SELECT e.measured_level FROM eligible AS e
       WHERE e.measured_level IS NOT NULL
       ORDER BY e.created_at DESC NULLS LAST, e.round DESC, e.id DESC
       LIMIT 1) AS ending
  )
  SELECT
    a.participation_count,
    s.task_fraction,
    s.measured_avg_rt,
    s.measured_median_rt,
    s.measured_avg_cue,
    s.measured_cue_reduction,
    l.beginning,
    l.ending,
    jsonb_build_object(
      'semantic_related', s.semantic_errors,
      'timeout', s.timeouts,
      'unrelated', s.unrelated_errors
    ),
    s.timeouts,
    s.scored_count,
    a.filler_count,
    a.no_response_count,
    a.background_noise_count,
    a.flagged_count
  FROM all_events AS a
  CROSS JOIN stats AS s
  CROSS JOIN levels AS l;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_session_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_session_summary(uuid)
  TO authenticated, service_role;

-- Rollback (restricted to reviewed deployment): restore the previously
-- captured function definition and ACLs from the migration artifact/backup.
-- Do not silently rewrite saved summaries or patient event histories.
