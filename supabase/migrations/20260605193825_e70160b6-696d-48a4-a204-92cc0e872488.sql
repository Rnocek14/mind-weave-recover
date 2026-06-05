-- Helper: is this user a clinician (new clinician role, or legacy moderator) or admin?
CREATE OR REPLACE FUNCTION public.is_clinician_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'clinician'::app_role)
      OR public.has_role(_user_id, 'moderator'::app_role)
      OR public.has_role(_user_id, 'admin'::app_role);
$$;

-- Caregiver -> patient link table
CREATE TABLE public.caregiver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid NOT NULL,
  patient_user_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  revoked_at timestamptz,
  revoked_by uuid,
  notes text,
  UNIQUE (caregiver_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_assignments TO authenticated;
GRANT ALL ON public.caregiver_assignments TO service_role;

ALTER TABLE public.caregiver_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all caregiver assignments"
ON public.caregiver_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Caregivers view own assignments"
ON public.caregiver_assignments FOR SELECT TO authenticated
USING (auth.uid() = caregiver_id AND revoked_at IS NULL);

CREATE POLICY "Patients view own caregiver assignments"
ON public.caregiver_assignments FOR SELECT TO authenticated
USING (auth.uid() = patient_user_id AND revoked_at IS NULL);

-- Helper: is this caregiver linked (active) to this profile?
CREATE OR REPLACE FUNCTION public.is_caregiver_for(_caregiver_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.caregiver_assignments
    WHERE caregiver_id = _caregiver_id
      AND profile_id = _profile_id
      AND revoked_at IS NULL
  );
$$;

-- Profiles: clinicians/admins can view all profiles
CREATE POLICY "Clinicians view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_clinician_or_admin(auth.uid()));

-- Profiles: caregivers can view their linked patient's profile
CREATE POLICY "Caregivers view linked profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_caregiver_for(auth.uid(), id));

-- user_roles: clinicians/admins can view all role rows (admin already had a policy; add clinician)
CREATE POLICY "Clinicians view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.is_clinician_or_admin(auth.uid()));