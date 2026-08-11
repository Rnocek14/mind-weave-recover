-- Account deletion integrity
--
-- Before this migration, auth.admin.deleteUser() could not actually clean up
-- an account:
--   1. Three audit columns (dismissed_flags.dismissed_by,
--      clinician_assignments.assigned_by / revoked_by) referenced
--      auth.users(id) with NO delete action, so deleting any user those
--      columns pointed at failed with an FK violation.
--   2. ~28 telemetry/clinical tables carry a user_id column with NO foreign
--      key at all, so their rows (PHI) survived account deletion as orphans.
--
-- Fixes: audit columns become ON DELETE SET NULL (audit rows survive, the
-- reference nulls out); the orphan-prone tables get an ON DELETE CASCADE
-- FK added NOT VALID — existing rows are not validated (so the migration
-- cannot fail on pre-existing orphans), but the cascade action fires for
-- every future delete, which is all account deletion needs.

-- ── 1. Audit columns: block → SET NULL ────────────────────────────────

ALTER TABLE public.dismissed_flags
  DROP CONSTRAINT IF EXISTS dismissed_flags_dismissed_by_fkey;
ALTER TABLE public.dismissed_flags
  ADD CONSTRAINT dismissed_flags_dismissed_by_fkey
  FOREIGN KEY (dismissed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.clinician_assignments
  DROP CONSTRAINT IF EXISTS clinician_assignments_assigned_by_fkey;
ALTER TABLE public.clinician_assignments
  ADD CONSTRAINT clinician_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.clinician_assignments
  DROP CONSTRAINT IF EXISTS clinician_assignments_revoked_by_fkey;
ALTER TABLE public.clinician_assignments
  ADD CONSTRAINT clinician_assignments_revoked_by_fkey
  FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. Orphan-prone user_id tables: add NOT VALID cascade FKs ─────────

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'adaptation_events',
    'adaptation_anomalies',
    'adaptation_trial_logs',
    'adaptive_decision_logs',
    'clinical_profile_corrections',
    'clinical_progression_state',
    'cognitive_domain_scores',
    'daily_readiness',
    'dose_logs',
    'dose_targets',
    'exercise_skips',
    'functional_checkins',
    'functional_goals',
    'outcome_predictions',
    'probe_results',
    'progression_events',
    'recovery_alerts',
    'recovery_score_snapshots',
    'recovery_summaries',
    'retention_snapshots',
    'shadow_events',
    'speech_profile_snapshots',
    'standardized_assessments',
    'survivor_self_start_events',
    'user_adaptation_profiles',
    'user_speech_profiles',
    'voice_session_summaries'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Skip tables that don't exist in this environment, and constraints
    -- already added by a previous run (idempotent re-apply).
    IF to_regclass('public.' || t) IS NOT NULL THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) ' ||
          'REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID',
          t, t || '_user_id_cascade_fkey'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_column THEN NULL; -- table has no user_id column here
      END;
    END IF;
  END LOOP;
END $$;

-- clinician_overrides keys the clinician author separately; cascade the
-- patient linkage only if the column exists (schema drifted across envs).
DO $$
BEGIN
  IF to_regclass('public.clinician_overrides') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'ALTER TABLE public.clinician_overrides ' ||
        'ADD CONSTRAINT clinician_overrides_user_id_cascade_fkey ' ||
        'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_column THEN NULL;
    END;
  END IF;
END $$;
