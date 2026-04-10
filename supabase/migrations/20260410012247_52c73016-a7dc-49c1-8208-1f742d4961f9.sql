-- Allow admins to update shadow events (for review marking)
CREATE POLICY "Admins can update shadow events"
ON public.shadow_events
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));