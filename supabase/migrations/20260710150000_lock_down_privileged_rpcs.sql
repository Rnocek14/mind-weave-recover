-- Security hardening: lock down SECURITY DEFINER RPCs that had no authorization
-- and were callable by any (or anonymous) PostgREST caller.
--
-- Findings addressed:
--   B1  setup_admin_user() — any caller could self-grant admin.
--   B2  clinician_* action RPCs — any authenticated user could tamper with any
--       patient's clinical settings and forge the audit trail (p_clinician_id was
--       caller-supplied and unverified).
--   H6  claim/submit_speech_analysis_* — any user could lock/poison the clinical
--       speech-analysis pipeline.
--
-- Fix: revoke EXECUTE from PUBLIC/anon/authenticated on all of these and grant it
-- only to service_role. The clinician actions are now reached exclusively through
-- the `clinician-action` edge function, which authenticates the caller, derives
-- the clinician identity from the JWT (never the request body), and verifies the
-- caller is an admin or the assigned clinician for the target profile before
-- invoking the RPC with the service-role key. The speech-analysis worker calls
-- its RPCs with the service-role key. setup_admin_user is bootstrap-only.
--
-- The DO block resolves each function's full signature from pg_proc so it works
-- regardless of argument overloads or default-argument variants.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'setup_admin_user',
        'clinician_adjust_difficulty',
        'clinician_assign_practice',
        'clinician_review_cueing',
        'clinician_reverse_override',
        'clinician_reduce_dose',
        'clinician_schedule_outreach',
        'clinician_suggest_override',
        'clinician_approve_override',
        'clinician_reject_override',
        'claim_speech_analysis_jobs',
        'submit_speech_analysis_result'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon;', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated;', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.sig);
  END LOOP;
END $$;
