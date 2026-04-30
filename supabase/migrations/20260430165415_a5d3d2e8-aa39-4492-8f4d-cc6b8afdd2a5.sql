-- 1. Add validity columns to utterance_analyses
ALTER TABLE public.utterance_analyses
  ADD COLUMN IF NOT EXISTS validity_label text,
  ADD COLUMN IF NOT EXISTS validity_reason text,
  ADD COLUMN IF NOT EXISTS validity_confidence numeric,
  ADD COLUMN IF NOT EXISTS validity_signals jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS counts_toward_score boolean NOT NULL DEFAULT true;

-- 2. Add validity columns to exercise_events
ALTER TABLE public.exercise_events
  ADD COLUMN IF NOT EXISTS validity_label text,
  ADD COLUMN IF NOT EXISTS validity_reason text,
  ADD COLUMN IF NOT EXISTS validity_confidence numeric,
  ADD COLUMN IF NOT EXISTS validity_signals jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS counts_toward_score boolean NOT NULL DEFAULT true;

-- 3. Validity label constraints
DO $$ BEGIN
  ALTER TABLE public.utterance_analyses
    ADD CONSTRAINT utterance_analyses_validity_label_chk
    CHECK (validity_label IS NULL OR validity_label IN (
      'valid_attempt','filler_only','no_response','background_noise','other_speaker_suspected','low_confidence'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.exercise_events
    ADD CONSTRAINT exercise_events_validity_label_chk
    CHECK (validity_label IS NULL OR validity_label IN (
      'valid_attempt','filler_only','no_response','background_noise','other_speaker_suspected','low_confidence'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_counts_toward_score
  ON public.utterance_analyses (session_id, counts_toward_score);
CREATE INDEX IF NOT EXISTS idx_exercise_events_counts_toward_score
  ON public.exercise_events (session_id, counts_toward_score);

-- 5. Replace get_session_summary (return signature changed → drop first)
DROP FUNCTION IF EXISTS public.get_session_summary(uuid);

CREATE FUNCTION public.get_session_summary(p_session_id uuid)
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
 SET search_path TO 'public'
AS $function$
DECLARE
  first_level INTEGER;
  last_level INTEGER;
  first_half_cues NUMERIC;
  second_half_cues NUMERIC;
BEGIN
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

  WITH trial_order AS (
    SELECT
      cue_level,
      ROW_NUMBER() OVER (ORDER BY created_at) as rn,
      COUNT(*) OVER () as total
    FROM exercise_events
    WHERE session_id = p_session_id
      AND counts_toward_score IS NOT FALSE
  )
  SELECT
    AVG(CASE WHEN rn <= total/2 THEN cue_level ELSE NULL END),
    AVG(CASE WHEN rn > total/2 THEN cue_level ELSE NULL END)
  INTO first_half_cues, second_half_cues
  FROM trial_order;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_trials,
    COALESCE(
      AVG(CASE WHEN counts_toward_score IS NOT FALSE AND score > 0 THEN 1.0
               WHEN counts_toward_score IS NOT FALSE THEN 0.0
               ELSE NULL END),
      0
    ) AS accuracy,
    COALESCE(AVG(reaction_time_ms) FILTER (WHERE counts_toward_score IS NOT FALSE)::INTEGER, 0) AS avg_rt_ms,
    COALESCE(
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY reaction_time_ms)
        FILTER (WHERE counts_toward_score IS NOT FALSE)::INTEGER,
      0
    ) AS median_rt_ms,
    COALESCE(AVG(cue_level) FILTER (WHERE counts_toward_score IS NOT FALSE), 0) AS avg_cue_level,
    COALESCE(first_half_cues - second_half_cues, 0) AS cue_reduction,
    COALESCE(first_level, 1) AS start_difficulty,
    COALESCE(last_level, 1) AS end_difficulty,
    jsonb_build_object(
      'semantic_related', COUNT(*) FILTER (WHERE counts_toward_score IS NOT FALSE AND error_type = 'semantic_related'),
      'timeout',          COUNT(*) FILTER (WHERE counts_toward_score IS NOT FALSE AND error_type = 'timeout'),
      'unrelated',        COUNT(*) FILTER (WHERE counts_toward_score IS NOT FALSE AND error_type = 'unrelated')
    ) AS error_breakdown,
    COUNT(*) FILTER (WHERE counts_toward_score IS NOT FALSE AND error_type = 'timeout')::BIGINT AS timeout_count,
    COUNT(*) FILTER (WHERE counts_toward_score IS NOT FALSE)::BIGINT AS valid_trials,
    COUNT(*) FILTER (WHERE validity_label = 'filler_only')::BIGINT AS filler_count,
    COUNT(*) FILTER (WHERE validity_label = 'no_response')::BIGINT AS no_response_count,
    COUNT(*) FILTER (WHERE validity_label = 'background_noise')::BIGINT AS background_noise_count,
    COUNT(*) FILTER (WHERE validity_label IN ('low_confidence','other_speaker_suspected'))::BIGINT AS flagged_count
  FROM exercise_events
  WHERE session_id = p_session_id;
END;
$function$;