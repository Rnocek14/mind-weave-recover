-- Drop the misleadingly named policy and the redundant admin-only policy
DROP POLICY IF EXISTS "Clinicians can view worker heartbeats" ON public.worker_heartbeats;
DROP POLICY IF EXISTS "Admins can view worker heartbeats" ON public.worker_heartbeats;

-- Create single correctly-named policy for staff (moderator + admin)
CREATE POLICY "Staff can view worker heartbeats"
ON public.worker_heartbeats
FOR SELECT
USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role));