-- 1. Stop broadcasting PHI over Realtime (exercise_events is not subscribed to in the app)
ALTER PUBLICATION supabase_realtime DROP TABLE public.exercise_events;

-- 2. Explicit admin-scoped write policies (service_role bypasses RLS; these cover admin-tool writes)
CREATE POLICY "Admins insert mastery health alerts"
  ON public.mastery_health_alerts FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert mastery health snapshots"
  ON public.mastery_health_snapshots FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert adaptation profiles"
  ON public.user_adaptation_profiles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update adaptation profiles"
  ON public.user_adaptation_profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));