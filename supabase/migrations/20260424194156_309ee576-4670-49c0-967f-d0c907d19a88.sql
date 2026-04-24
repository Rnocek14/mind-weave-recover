CREATE POLICY "Admins can view all exercise events"
ON public.exercise_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));