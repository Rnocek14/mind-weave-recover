-- Narrow patient-scoped authorization for legacy SECURITY DEFINER RPCs.
-- Existing client signatures and scoring formulas are preserved.
-- Do not deploy without staging access-control tests and clinician review.

CREATE SCHEMA IF NOT EXISTS private;

-- A non-Data-API helper. Called only from privileged SQL functions.
CREATE OR REPLACE FUNCTION private.can_access_stroke_patient(
  p_user_id uuid,
  p_profile_id uuid DEFAULT NULL,
  p_read_only boolean DEFAULT true
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $auth$
  SELECT
    session_user = 'postgres'
    OR COALESCE(auth.jwt()->>'role' = 'service_role', false)
    OR (
      auth.uid() IS NOT NULL AND (
        auth.uid() = p_user_id
        OR COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false)
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = p_user_id
            AND (p_profile_id IS NULL OR p.id = p_profile_id)
            AND (
              COALESCE(public.is_assigned_clinician(auth.uid(), p.id), false)
              OR (p_read_only AND COALESCE(public.is_caregiver_for(auth.uid(), p.id), false))
            )
        )
      )
    );
$auth$;

REVOKE ALL ON FUNCTION private.can_access_stroke_patient(uuid,uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_stroke_patient(uuid,uuid,boolean) FROM anon;
REVOKE ALL ON FUNCTION private.can_access_stroke_patient(uuid,uuid,boolean) FROM authenticated;

-- Clinical profile JSON previously accepted an arbitrary user UUID.
CREATE OR REPLACE FUNCTION public.get_active_clinical_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $profile$
  SELECT COALESCE(v.profile_data, '{}'::jsonb)
  FROM public.clinical_profile_versions v
  WHERE v.user_id = p_user_id
    AND v.is_active = true
    AND private.can_access_stroke_patient(p_user_id, NULL, true)
  ORDER BY v.version_number DESC
  LIMIT 1;
$profile$;

-- Preserve the existing versioning/diff implementation but authorize writes.
-- The previous version trusted a caller-supplied p_user_id and p_created_by.
CREATE OR REPLACE FUNCTION public.create_profile_version(
  p_user_id uuid,
  p_profile_data jsonb,
  p_source_type text,
  p_source_note_id uuid DEFAULT NULL,
  p_change_reason text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $version$
DECLARE
  v_version_number integer;
  v_new_id uuid;
  v_previous_profile jsonb;
BEGIN
  IF NOT private.can_access_stroke_patient(p_user_id, NULL, false) THEN
    RAISE EXCEPTION 'Not authorized to update clinical profile'
      USING ERRCODE = '42501';
  END IF;
  IF p_profile_data IS NULL OR jsonb_typeof(p_profile_data) <> 'object' THEN
    RAISE EXCEPTION 'Clinical profile must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize version allocation per patient without blocking other patients.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT profile_data INTO v_previous_profile
  FROM public.clinical_profile_versions
  WHERE user_id = p_user_id AND is_active = true;

  UPDATE public.clinical_profile_versions
  SET is_active = false
  WHERE user_id = p_user_id AND is_active = true;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
  FROM public.clinical_profile_versions
  WHERE user_id = p_user_id;

  INSERT INTO public.clinical_profile_versions (
    user_id, version_number, profile_data, source_type,
    source_note_id, change_reason, created_by, is_active,
    changes_from_previous
  ) VALUES (
    p_user_id, v_version_number, p_profile_data, p_source_type,
    p_source_note_id, p_change_reason, COALESCE(auth.uid(), p_created_by),
    true,
    CASE WHEN v_previous_profile IS NOT NULL
      THEN jsonb_build_object(
        'added_fields', p_profile_data - (SELECT array_agg(key) FROM jsonb_object_keys(v_previous_profile) key),
        'removed_fields', v_previous_profile - (SELECT array_agg(key) FROM jsonb_object_keys(p_profile_data) key)
      )
      ELSE '{}'::jsonb
    END
  ) RETURNING id INTO v_new_id;

  UPDATE public.profiles
  SET clinical_profile = p_profile_data
  WHERE user_id = p_user_id;

  RETURN v_new_id;
END;
$version$;

-- Both overloads retain their output types but filter each source session
-- through patient/assigned-clinician/caregiver authorization.
CREATE OR REPLACE FUNCTION public.get_exercise_stats_last7d(uid uuid, slug text)
RETURNS TABLE(avg_accuracy numeric, median_rt integer, trial_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $stats$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(AVG(CASE WHEN e.score > 0 THEN 1.0 ELSE 0.0 END), 0),
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY e.reaction_time_ms), 0)::integer,
    COUNT(*)::bigint
  FROM public.exercise_events e
  JOIN public.sessions s ON s.id=e.session_id
  WHERE s.user_id = uid AND e.exercise_slug = slug
    AND s.started_at > now() - interval '7 days'
    AND e.reaction_time_ms IS NOT NULL
    AND private.can_access_stroke_patient(uid, s.profile_id, true);
END;
$stats$;

CREATE OR REPLACE FUNCTION public.get_exercise_stats_last7d(uid uuid, slug text, pid uuid DEFAULT NULL)
RETURNS TABLE(avg_accuracy numeric, median_rt integer, trial_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $stats_profile$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(AVG(CASE WHEN e.score > 0 THEN 1.0 ELSE 0.0 END), 0),
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY e.reaction_time_ms), 0)::integer,
    COUNT(*)::bigint
  FROM public.exercise_events e
  JOIN public.sessions s ON s.id=e.session_id
  WHERE s.user_id = uid AND e.exercise_slug = slug
    AND (pid IS NULL OR s.profile_id = pid)
    AND s.started_at > now() - interval '7 days'
    AND e.reaction_time_ms IS NOT NULL
    AND private.can_access_stroke_patient(uid, s.profile_id, true);
END;
$stats_profile$;

-- The session summary formerly returned arbitrary patient trial analytics to
-- anyone who supplied a session UUID. Preserve its complete original formula.
CREATE OR REPLACE FUNCTION public.get_session_summary(p_session_id uuid)
RETURNS TABLE(
 total_trials bigint, accuracy numeric, avg_rt_ms integer, median_rt_ms integer,
 avg_cue_level numeric, cue_reduction numeric, start_difficulty integer,
 end_difficulty integer, error_breakdown jsonb, timeout_count bigint,
 valid_trials bigint, filler_count bigint, no_response_count bigint,
 background_noise_count bigint, flagged_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $summary$
DECLARE
 first_level integer;
 last_level integer;
 first_half_cues numeric;
 second_half_cues numeric;
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.sessions s
   WHERE s.id = p_session_id
     AND private.can_access_stroke_patient(s.user_id, s.profile_id, true)
 ) THEN
   RAISE EXCEPTION 'Not authorized to view session summary'
     USING ERRCODE = '42501';
 END IF;

 SELECT (inputs->'task_params'->>'difficulty_level')::integer
 INTO first_level
 FROM public.exercise_events
 WHERE session_id = p_session_id ORDER BY created_at ASC, round ASC, id ASC LIMIT 1;

 SELECT (inputs->'task_params'->>'difficulty_level')::integer
 INTO last_level
 FROM public.exercise_events
 WHERE session_id = p_session_id ORDER BY created_at DESC, round DESC, id DESC LIMIT 1;

 WITH trial_order AS (
   SELECT cue_level,
     ROW_NUMBER() OVER (ORDER BY created_at ASC, round ASC, id ASC) AS rn,
     COUNT(*) OVER () AS total
   FROM public.exercise_events
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
   COUNT(*)::bigint AS total_trials,
   COALESCE(AVG(
     CASE WHEN counts_toward_score IS NOT FALSE AND score > 0 THEN 1.0
          WHEN counts_toward_score IS NOT FALSE THEN 0.0
          ELSE NULL END
   ),0) AS accuracy,
   COALESCE(AVG(reaction_time_ms) FILTER (WHERE counts_toward_score IS NOT FALSE)::integer,0) AS avg_rt_ms,
   COALESCE(
     PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY reaction_time_ms)
       FILTER (WHERE counts_toward_score IS NOT FALSE)::integer,
     0
   ) AS median_rt_ms,
   COALESCE(AVG(cue_level) FILTER (WHERE counts_toward_score IS NOT FALSE),0) AS avg_cue_level,
   COALESCE(first_half_cues-second_half_cues,0) AS cue_reduction,
   COALESCE(first_level,1) AS start_difficulty,
   COALESCE(last_level,1) AS end_difficulty,
   jsonb_build_object(
     'semantic_related',COUNT(*) FILTER (WHERE counts_toward_score IS NOT FALSE AND error_type='semantic_related'),
     'timeout',COUNT(*) FILTER (WHERE counts_toward_score IS NOT FALSE AND error_type='timeout'),
     'unrelated',COUNT(*) FILTER (WHERE counts_toward_score IS NOT FALSE AND error_type='unrelated')
   ) AS error_breakdown,
   COUNT(*) FILTER (WHERE counts_toward_score IS NOT FALSE AND error_type='timeout')::bigint AS timeout_count,
   COUNT(*) FILTER (WHERE counts_toward_score IS NOT FALSE)::bigint AS valid_trials,
   COUNT(*) FILTER (WHERE validity_label='filler_only')::bigint AS filler_count,
   COUNT(*) FILTER (WHERE validity_label='no_response')::bigint AS no_response_count,
   COUNT(*) FILTER (WHERE validity_label='background_noise')::bigint AS background_noise_count,
   COUNT(*) FILTER (WHERE validity_label IN ('low_confidence','other_speaker_suspected'))::bigint AS flagged_count
 FROM public.exercise_events
 WHERE session_id = p_session_id;
END;
$summary$;

-- Never expose patient-scoped privileged functions to anonymous requests.
DO $grants$
DECLARE r record;
BEGIN
 FOR r IN SELECT p.oid::regprocedure AS sig
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname IN (
       'get_active_clinical_profile','create_profile_version',
       'get_exercise_stats_last7d','get_session_summary',
       'close_stale_sessions','review_role_request',
       'get_cluster_assignments','get_cluster_learning_rates',
       'get_active_profile','get_resumable_session'
     )
 LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;',r.sig);
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon;',r.sig);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;',r.sig);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;',r.sig);
 END LOOP;
END;
$grants$;

-- Queue maintenance and worker heartbeat must only be called by trusted jobs.
DO $worker$
DECLARE r record;
BEGIN
 FOR r IN SELECT p.oid::regprocedure AS sig
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname IN ('release_stale_speech_locks','upsert_worker_heartbeat')
 LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;',r.sig);
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon;',r.sig);
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated;',r.sig);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;',r.sig);
 END LOOP;
END;
$worker$;
