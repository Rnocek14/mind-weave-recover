-- Atomic session-summary persistence.
--
-- Problem: multiple client writers currently SELECT sessions.summary, merge in
-- JavaScript, then UPDATE the entire JSON document. Two writers can read the
-- same old value and the later UPDATE silently erases fields written by the
-- first. For clinical telemetry, a lost field is indistinguishable from data
-- that never existed.
--
-- These RPCs merge inside one PostgreSQL UPDATE, where row locking serializes
-- concurrent writers. Top-level keys merge atomically and the nested "scores"
-- object is merged by exercise slug instead of replaced wholesale.
--
-- SECURITY INVOKER is deliberate: normal sessions RLS remains authoritative.
-- Anonymous callers are not allowed to execute these functions.

CREATE OR REPLACE FUNCTION public.merge_session_summary(
  p_session_id uuid,
  p_summary_patch jsonb,
  p_require_open boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows integer := 0;
  v_patch jsonb :=
    CASE
      WHEN jsonb_typeof(COALESCE(p_summary_patch, '{}'::jsonb)) = 'object'
        THEN COALESCE(p_summary_patch, '{}'::jsonb)
      ELSE '{}'::jsonb
    END;
BEGIN
  UPDATE public.sessions AS s
  SET summary =
    (
      CASE
        WHEN jsonb_typeof(COALESCE(s.summary, '{}'::jsonb)) = 'object'
          THEN COALESCE(s.summary, '{}'::jsonb)
        ELSE '{}'::jsonb
      END
      || (v_patch - 'scores')
    )
    ||
    CASE
      WHEN v_patch ? 'scores'
        AND jsonb_typeof(v_patch->'scores') = 'object'
      THEN jsonb_build_object(
        'scores',
        COALESCE(
          CASE
            WHEN jsonb_typeof(s.summary->'scores') = 'object' THEN s.summary->'scores'
            ELSE '{}'::jsonb
          END,
          '{}'::jsonb
        ) || (v_patch->'scores')
      )
      ELSE '{}'::jsonb
    END
  WHERE s.id = p_session_id
    AND (NOT p_require_open OR s.ended_at IS NULL);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_session_with_summary_patch(
  p_session_id uuid,
  p_summary_patch jsonb,
  p_duration_sec integer,
  p_ended_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows integer := 0;
  v_patch jsonb :=
    CASE
      WHEN jsonb_typeof(COALESCE(p_summary_patch, '{}'::jsonb)) = 'object'
        THEN COALESCE(p_summary_patch, '{}'::jsonb)
      ELSE '{}'::jsonb
    END;
BEGIN
  UPDATE public.sessions AS s
  SET ended_at = now(),
      duration_sec = p_duration_sec,
      ended_reason = p_ended_reason,
      summary =
        (
          CASE
            WHEN jsonb_typeof(COALESCE(s.summary, '{}'::jsonb)) = 'object'
              THEN COALESCE(s.summary, '{}'::jsonb)
            ELSE '{}'::jsonb
          END
          || (v_patch - 'scores')
        )
        ||
        CASE
          WHEN v_patch ? 'scores'
            AND jsonb_typeof(v_patch->'scores') = 'object'
          THEN jsonb_build_object(
            'scores',
            COALESCE(
              CASE
                WHEN jsonb_typeof(s.summary->'scores') = 'object' THEN s.summary->'scores'
                ELSE '{}'::jsonb
              END,
              '{}'::jsonb
            ) || (v_patch->'scores')
          )
          ELSE '{}'::jsonb
        END
  WHERE s.id = p_session_id
    AND s.ended_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- Keep the legacy RPC compatible, but stop it from replacing the whole summary.
-- Its existing auth.uid() ownership predicate remains unchanged.
CREATE OR REPLACE FUNCTION public.end_session_server(
  p_session_id uuid,
  p_summary jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.sessions AS s
  SET ended_at = now(),
      duration_sec = extract(epoch from (now() - coalesce(started_at, now())))::integer,
      summary =
        (
          CASE
            WHEN jsonb_typeof(COALESCE(s.summary, '{}'::jsonb)) = 'object'
              THEN COALESCE(s.summary, '{}'::jsonb)
            ELSE '{}'::jsonb
          END
          || (
            CASE
              WHEN jsonb_typeof(COALESCE(p_summary, '{}'::jsonb)) = 'object'
                THEN COALESCE(p_summary, '{}'::jsonb)
              ELSE '{}'::jsonb
            END
            - 'scores'
          )
        )
        ||
        CASE
          WHEN jsonb_typeof(COALESCE(p_summary, '{}'::jsonb)) = 'object'
            AND COALESCE(p_summary, '{}'::jsonb) ? 'scores'
            AND jsonb_typeof(p_summary->'scores') = 'object'
          THEN jsonb_build_object(
            'scores',
            COALESCE(
              CASE
                WHEN jsonb_typeof(s.summary->'scores') = 'object' THEN s.summary->'scores'
                ELSE '{}'::jsonb
              END,
              '{}'::jsonb
            ) || (p_summary->'scores')
          )
          ELSE '{}'::jsonb
        END
  WHERE s.id = p_session_id
    AND s.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.merge_session_summary(uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_session_summary(uuid, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_session_summary(uuid, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_session_summary(uuid, jsonb, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.end_session_with_summary_patch(uuid, jsonb, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_session_with_summary_patch(uuid, jsonb, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.end_session_with_summary_patch(uuid, jsonb, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_session_with_summary_patch(uuid, jsonb, integer, text) TO service_role;
