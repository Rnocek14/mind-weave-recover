DROP POLICY IF EXISTS "Assigned clinicians view patient self-start events" ON public.survivor_self_start_events;

CREATE POLICY "Assigned clinicians view patient self-start events"
ON public.survivor_self_start_events
FOR SELECT
TO authenticated
USING (
  (profile_id IS NOT NULL AND public.is_assigned_clinician(auth.uid(), profile_id))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);