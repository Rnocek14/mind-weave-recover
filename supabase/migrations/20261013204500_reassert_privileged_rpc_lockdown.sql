-- Reassert privileged RPC lockdown on environments that skipped the July 2026
-- security migration.
--
-- Production migration history currently jumps from 20260610 to 20260917, so
-- 20260710150000_lock_down_privileged_rpcs.sql is present in source control but
-- was never recorded/applied on the live Stroke project.
--
-- These functions are SECURITY DEFINER and either mutate privileged clinical
-- state, administer roles, or operate the speech-analysis worker queue. They
-- must not be callable directly by PUBLIC/anon/authenticated clients.
--
-- Legitimate access paths:
--   * clinician_* actions -> clinician-action Edge Function (authz + service role)
--   * speech worker RPCs   -> trusted database/service execution
--   * setup_admin_user     -> administrative/bootstrap execution only
--
-- Safe to re-run: REVOKE/GRANT are idempotent.

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
