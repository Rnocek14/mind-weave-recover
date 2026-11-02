-- NeuroSpark hospital pilot: explicit elevated-RPC access perimeter.
-- This file is a DRAFT migration for clinician/security review and isolated
-- verification. It does NOT certify HIPAA compliance or clinical safety.
-- CRITICAL: production was found granting PUBLIC/anon/authenticated EXECUTE on
-- setup_admin_user, speech worker jobs, and several patient-profile/session RPCs.
-- Never use SQL-only tests as evidence that real role/ownership checks worked.
-- Existing live data MUST be preserved, never silently rewritten.
-- Revision: 2026-11-02. No rows or auth accounts are created or modified here.

CREATE SCHEMA IF NOT EXISTS private;

-- Proven patient-scope helpers from the isolated branch, ported here because
-- production currently lacks both definitions. Authorization is per request,
-- not based on caller-supplied patient IDs or editable user metadata.
CREATE OR REPLACE FUNCTION private.can_access_stroke_patient(p_user_id uuid, p_profile_id uuid DEFAULT NULL::uuid, p_read_only boolean DEFAULT true)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION private.can_access_stroke_user_scoped(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    session_user = 'postgres'
    OR COALESCE(auth.jwt()->>'role' = 'service_role', false)
    OR (
      auth.uid() IS NOT NULL AND (
        auth.uid() = p_user_id
        OR COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false)
      )
    );
$function$;

REVOKE ALL ON FUNCTION private.can_access_stroke_user_scoped(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_access_stroke_patient(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;

/* get_active_clinical_profile — retain existing scoring behavior; authorize before data access */
CREATE OR REPLACE FUNCTION public.get_active_clinical_profile(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(v.profile_data, '{}'::jsonb)
  FROM public.clinical_profile_versions v
  WHERE v.user_id = p_user_id
    AND v.is_active = true
    AND private.can_access_stroke_user_scoped(p_user_id)
  ORDER BY v.version_number DESC
  LIMIT 1;
$function$
;

/* get_session_summary — retain existing scoring behavior; authorize before data access */
CREATE OR REPLACE FUNCTION public.get_session_summary(p_session_id uuid)
 RETURNS TABLE(total_trials bigint, accuracy numeric, avg_rt_ms integer, median_rt_ms integer, avg_cue_level numeric, cue_reduction numeric, start_difficulty integer, end_difficulty integer, error_breakdown jsonb, timeout_count bigint, valid_trials bigint, filler_count bigint, no_response_count bigint, background_noise_count bigint, flagged_count bigint)
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
  IF p_session_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = p_session_id
      AND private.can_access_stroke_patient(s.user_id,s.profile_id,true)
  ) THEN
    RAISE EXCEPTION 'Not authorized to view session summary' USING ERRCODE = '42501';
  END IF;

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
$function$
;

/* create_profile_version — retain existing scoring behavior; authorize before data access */
CREATE OR REPLACE FUNCTION public.create_profile_version(p_user_id uuid, p_profile_data jsonb, p_source_type text, p_source_note_id uuid DEFAULT NULL::uuid, p_change_reason text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_version_number INTEGER;
  v_new_id UUID;
  v_previous_profile JSONB;
BEGIN
  IF NOT private.can_access_stroke_user_scoped(p_user_id) THEN
    RAISE EXCEPTION 'Not authorized to update clinical profile' USING ERRCODE = '42501';
  END IF;

  -- Get previous profile data for diff
  SELECT profile_data INTO v_previous_profile
  FROM clinical_profile_versions
  WHERE user_id = p_user_id AND is_active = true;
  
  -- Deactivate previous version
  UPDATE clinical_profile_versions
  SET is_active = false
  WHERE user_id = p_user_id AND is_active = true;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_version_number
  FROM clinical_profile_versions
  WHERE user_id = p_user_id;
  
  -- Create new version
  INSERT INTO clinical_profile_versions (
    user_id,
    version_number,
    profile_data,
    source_type,
    source_note_id,
    change_reason,
    created_by,
    is_active,
    changes_from_previous
  ) VALUES (
    p_user_id,
    v_version_number,
    p_profile_data,
    p_source_type,
    p_source_note_id,
    p_change_reason,
    COALESCE(auth.uid(), p_created_by),  -- caller identity wins; service may supply fallback
    true,
    CASE 
      WHEN v_previous_profile IS NOT NULL THEN
        jsonb_build_object(
          'added_fields', p_profile_data - (SELECT array_agg(key) FROM jsonb_object_keys(v_previous_profile) key),
          'removed_fields', v_previous_profile - (SELECT array_agg(key) FROM jsonb_object_keys(p_profile_data) key)
        )
      ELSE '{}'::jsonb
    END
  ) RETURNING id INTO v_new_id;
  
  -- Update active profile in profiles table
  UPDATE profiles
  SET clinical_profile = p_profile_data
  WHERE user_id = p_user_id;
  
  RETURN v_new_id;
END;
$function$
;

/* get_exercise_stats_last7d uid uuid, slug text — retain existing scoring behavior; authorize before data access */
CREATE OR REPLACE FUNCTION public.get_exercise_stats_last7d(uid uuid, slug text)
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
    AND s.started_at > now() - interval '7 days'
    AND e.reaction_time_ms IS NOT NULL
    AND private.can_access_stroke_patient(uid,s.profile_id,true);
END;
$function$
;

/* get_exercise_stats_last7d uid uuid, slug text, pid uuid — retain existing scoring behavior; authorize before data access */
CREATE OR REPLACE FUNCTION public.get_exercise_stats_last7d(uid uuid, slug text, pid uuid DEFAULT NULL::uuid)
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
    AND e.reaction_time_ms IS NOT NULL
    AND private.can_access_stroke_patient(uid,s.profile_id,true);
END;
$function$
;

/* telemetry_bucketed — retain existing scoring behavior; authorize before data access */
CREATE OR REPLACE FUNCTION public.telemetry_bucketed(_window text)
 RETURNS TABLE(bucket_start timestamp with time zone, exercise_slug text, total bigint, with_error_type bigint, with_adaptations bigint, with_signal bigint, adaptation_event_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_interval interval;
  v_bucket   interval;
BEGIN
  -- Preserve backend/cron service operations; signed-in humans still
  -- require the admin role. A public caller cannot forge the service JWT.
  IF NOT (
    session_user = 'postgres'
    OR COALESCE(auth.jwt()->>'role' = 'service_role',false)
    OR (auth.uid() IS NOT NULL AND COALESCE(public.has_role(auth.uid(),'admin'::public.app_role),false))
  ) THEN
    RAISE EXCEPTION 'Not authorized to operate clinical administration' USING ERRCODE = '42501';
  END IF;

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
$function$
;

/* refresh_cluster_assignments — retain existing scoring behavior; authorize before data access */
CREATE OR REPLACE FUNCTION public.refresh_cluster_assignments()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Preserve backend/cron service operations; signed-in humans still
  -- require the admin role. A public caller cannot forge the service JWT.
  IF NOT (
    session_user = 'postgres'
    OR COALESCE(auth.jwt()->>'role' = 'service_role',false)
    OR (auth.uid() IS NOT NULL AND COALESCE(public.has_role(auth.uid(),'admin'::public.app_role),false))
  ) THEN
    RAISE EXCEPTION 'Not authorized to operate clinical administration' USING ERRCODE = '42501';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY user_cluster_assignments;
END;
$function$
;
-- Restrict all worker/admin operations to the backend service role. Explicitly
-- revoke PUBLIC (PostgreSQL grants public function EXECUTE by default), not just
-- anon/authenticated, because inherited PUBLIC grants bypass narrower revokes.
DO $hospital_security$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature, p.proname AS name
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN (
        'setup_admin_user',
        'clinician_adjust_difficulty','clinician_assign_practice',
        'clinician_review_cueing','clinician_reverse_override',
        'clinician_reduce_dose','clinician_schedule_outreach',
        'clinician_suggest_override','clinician_approve_override',
        'clinician_reject_override','claim_speech_analysis_jobs',
        'submit_speech_analysis_result','upsert_worker_heartbeat',
        'release_stale_speech_locks','close_stale_sessions',
        'set_profile_id_from_session','validate_functional_checkin'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;

  -- These patient/clinician RPCs remain callable by signed-in users but every
  -- result or modification is protected by a scoped per-request guard above.
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN (
        'get_active_clinical_profile','get_session_summary',
        'get_exercise_stats_last7d','create_profile_version',
        'telemetry_bucketed','refresh_cluster_assignments',
        'get_active_profile','get_resumable_session','end_session_server',
        'switch_active_profile','merge_profile_pref',
        'get_cluster_assignments','get_cluster_learning_rates',
        'review_role_request','advance_enrollment_after_consent','withdraw_enrollment'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',f.signature);
  END LOOP;
END;
$hospital_security$;

-- POST-DEPLOY REQUIRED: on an isolated backend inspect has_function_privilege
-- for anon/authenticated/service_role, test cross-user 42501 on real signed-in
-- synthetic accounts, check every affected client RPC, and read back telemetry.
-- No deployment to production is authorized by this migration file alone.
