
-- Clinician-patient assignment table for scoped access
CREATE TABLE public.clinician_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  notes text,
  UNIQUE (clinician_id, profile_id)
);

ALTER TABLE public.clinician_assignments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check assignment
CREATE OR REPLACE FUNCTION public.is_assigned_clinician(_clinician_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinician_assignments
    WHERE clinician_id = _clinician_id
      AND profile_id = _profile_id
      AND revoked_at IS NULL
  )
$$;

-- Admins can manage all assignments
CREATE POLICY "Admins manage all assignments"
ON public.clinician_assignments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Clinicians can view their own assignments
CREATE POLICY "Clinicians view own assignments"
ON public.clinician_assignments
FOR SELECT
TO authenticated
USING (auth.uid() = clinician_id AND revoked_at IS NULL);

-- Patients can see who is assigned to them
CREATE POLICY "Patients view own assignments"
ON public.clinician_assignments
FOR SELECT
TO authenticated
USING (auth.uid() = patient_user_id AND revoked_at IS NULL);

-- Add clinician scoped access to key patient tables
-- Clinicians can view profiles of assigned patients
CREATE POLICY "Clinicians view assigned profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_assigned_clinician(auth.uid(), id));

-- Clinicians can view sessions of assigned patients
CREATE POLICY "Clinicians view assigned sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (public.is_assigned_clinician(auth.uid(), profile_id));

-- Clinicians can view exercise events of assigned patients
CREATE POLICY "Clinicians view assigned exercise events"
ON public.exercise_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = exercise_events.session_id
      AND public.is_assigned_clinician(auth.uid(), s.profile_id)
  )
);

-- Clinicians can view and manage alerts of assigned patients
CREATE POLICY "Clinicians view assigned alerts"
ON public.recovery_alerts
FOR SELECT
TO authenticated
USING (public.is_assigned_clinician(auth.uid(), profile_id));

CREATE POLICY "Clinicians update assigned alerts"
ON public.recovery_alerts
FOR UPDATE
TO authenticated
USING (public.is_assigned_clinician(auth.uid(), profile_id));

-- Clinicians can view learning rates of assigned patients
CREATE POLICY "Clinicians view assigned learning rates"
ON public.learning_rates
FOR SELECT
TO authenticated
USING (public.is_assigned_clinician(auth.uid(), profile_id));

-- Clinicians can view functional goals of assigned patients
CREATE POLICY "Clinicians view assigned goals"
ON public.functional_goals
FOR SELECT
TO authenticated
USING (public.is_assigned_clinician(auth.uid(), profile_id));

-- Clinicians can view goal ratings of assigned patients
CREATE POLICY "Clinicians view assigned goal ratings"
ON public.goal_progress_ratings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM functional_goals fg
    WHERE fg.id = goal_progress_ratings.goal_id
      AND public.is_assigned_clinician(auth.uid(), fg.profile_id)
  )
);

-- Clinicians can manage overrides for assigned patients
CREATE POLICY "Clinicians manage assigned overrides"
ON public.clinician_overrides
FOR ALL
TO authenticated
USING (public.is_assigned_clinician(auth.uid(), profile_id))
WITH CHECK (public.is_assigned_clinician(auth.uid(), profile_id));

-- Clinicians can view standardized assessments of assigned patients
CREATE POLICY "Clinicians view assigned assessments"
ON public.standardized_assessments
FOR SELECT
TO authenticated
USING (public.is_assigned_clinician(auth.uid(), profile_id));

-- Clinicians can insert assessments for assigned patients
CREATE POLICY "Clinicians insert assigned assessments"
ON public.standardized_assessments
FOR INSERT
TO authenticated
WITH CHECK (public.is_assigned_clinician(auth.uid(), profile_id));
