-- clinician_overrides: drop patient-exploitable self-claim policies.
-- Assigned-clinician ALL + admin ALL policies remain and cover legitimate writes.
DROP POLICY IF EXISTS "Users insert own overrides" ON public.clinician_overrides;
DROP POLICY IF EXISTS "Users update own overrides" ON public.clinician_overrides;

-- clinician_session_notes: drop patient-exploitable self-claim policy.
-- Assigned-clinician ALL + admin ALL policies remain.
DROP POLICY IF EXISTS "Users manage own clinician notes" ON public.clinician_session_notes;

-- validity_override_events: replace weak insert with role/assignment-scoped insert.
DROP POLICY IF EXISTS "Clinicians insert own override events" ON public.validity_override_events;
CREATE POLICY "Assigned clinicians insert override events"
ON public.validity_override_events
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = clinician_id
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (profile_id IS NOT NULL AND public.is_assigned_clinician(auth.uid(), profile_id))
  )
);