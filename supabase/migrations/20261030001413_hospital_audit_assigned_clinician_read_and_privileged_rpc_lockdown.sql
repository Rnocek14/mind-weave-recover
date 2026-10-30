-- Hospital pilot #80/#84: clinician SELECT-only evidence, and maintenance RPC ACLs.
-- Applied and tested ONLY on isolated Supabase branch stdiuaxigqttgdwiwbtp
-- as migration version 20261030001413. Never deploy to production without
-- an explicit clinical access review and the isolated role-based QA test.
--
-- Assigned clinicians may view the exact patient profile while its
-- clinician_assignments row exists and revoked_at IS NULL. The policy helper
-- uses auth.uid(), not a client-provided user ID, and remains RLS-mediated.
-- No clinician INSERT/UPDATE/DELETE policy is introduced.
--
-- Rollback after review (not automatically applied):
--   DROP POLICY IF EXISTS "hospital_audit_clinician_read_utterances" ON public.utterance_analyses;
--   DROP POLICY IF EXISTS "hospital_audit_clinician_read_adaptation" ON public.adaptation_trial_logs;
--   DROP POLICY IF EXISTS "hospital_audit_clinician_read_dose" ON public.dose_logs;
--   DROP POLICY IF EXISTS "hospital_audit_clinician_read_readiness" ON public.daily_readiness;
--   DROP POLICY IF EXISTS "hospital_audit_clinician_read_physical" ON public.physical_daily_metrics;
--   REVOKE SELECT ON public.dose_logs, public.daily_readiness,
--     public.physical_daily_metrics FROM authenticated;
--   GRANT EXECUTE ON FUNCTION public.refresh_cluster_assignments() TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO PUBLIC;
-- NOTE: Rollback reopens the previously discovered vulnerabilities and should
-- only be used for emergency compatibility on an isolated environment.

CREATE POLICY "hospital_audit_clinician_read_utterances"
ON public.utterance_analyses FOR SELECT TO authenticated
USING (
  profile_id IS NOT NULL
  AND public.is_assigned_clinician((select auth.uid()), profile_id)
);

CREATE POLICY "hospital_audit_clinician_read_adaptation"
ON public.adaptation_trial_logs FOR SELECT TO authenticated
USING (
  profile_id IS NOT NULL
  AND public.is_assigned_clinician((select auth.uid()), profile_id)
);

CREATE POLICY "hospital_audit_clinician_read_dose"
ON public.dose_logs FOR SELECT TO authenticated
USING (public.is_assigned_clinician((select auth.uid()), profile_id));

CREATE POLICY "hospital_audit_clinician_read_readiness"
ON public.daily_readiness FOR SELECT TO authenticated
USING (public.is_assigned_clinician((select auth.uid()), profile_id));

CREATE POLICY "hospital_audit_clinician_read_physical"
ON public.physical_daily_metrics FOR SELECT TO authenticated
USING (public.is_assigned_clinician((select auth.uid()), profile_id));

-- These tables had RLS but no SELECT grant to authenticated: even assigned
-- clinicians were denied at the privilege layer, before RLS could permit rows.
GRANT SELECT ON TABLE public.dose_logs,
  public.daily_readiness, public.physical_daily_metrics TO authenticated;

-- The SECURITY DEFINER refresh has no user check; only trusted maintenance
-- code may execute it. Preserve service_role access for background jobs.
REVOKE ALL ON FUNCTION public.refresh_cluster_assignments()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_cluster_assignments()
  TO service_role;

-- Existing RLS policies rely on has_role(auth.uid(), ...), so authenticated
-- callers retain EXECUTE, while anon no longer has a direct privileged RPC.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO authenticated, service_role;
