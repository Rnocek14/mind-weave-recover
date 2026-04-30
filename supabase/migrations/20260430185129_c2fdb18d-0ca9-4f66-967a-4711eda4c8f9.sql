-- Phase A completion: enrollment progression RPC + amend RLS to allow it.
-- Append-only RLS prevents direct UPDATEs from clinicians, so we route the
-- one allowed status transition (eligible -> active after consent) through a
-- security-definer function that validates a signed consent record exists.

CREATE OR REPLACE FUNCTION public.advance_enrollment_after_consent(_enrollment_id uuid)
RETURNS public.study_enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enrollment public.study_enrollments;
  _has_consent boolean;
  _is_clinician boolean;
  _is_patient boolean;
BEGIN
  SELECT * INTO _enrollment
  FROM public.study_enrollments
  WHERE id = _enrollment_id;

  IF _enrollment.id IS NULL THEN
    RAISE EXCEPTION 'Enrollment % not found', _enrollment_id USING ERRCODE = 'P0002';
  END IF;

  -- Authorization: assigned clinician, study PI, admin, or the patient themselves
  _is_clinician := public.is_assigned_clinician(auth.uid(), _enrollment.profile_id)
                   OR EXISTS (SELECT 1 FROM public.studies s
                              WHERE s.id = _enrollment.study_id
                                AND s.pi_clinician_id = auth.uid())
                   OR public.has_role(auth.uid(), 'admin'::app_role);
  _is_patient := (_enrollment.user_id = auth.uid());

  IF NOT (_is_clinician OR _is_patient) THEN
    RAISE EXCEPTION 'Not authorized to advance enrollment %', _enrollment_id
      USING ERRCODE = '42501';
  END IF;

  -- Must have at least one signed consent record
  SELECT EXISTS (
    SELECT 1 FROM public.consent_records cr
    WHERE cr.enrollment_id = _enrollment_id
  ) INTO _has_consent;

  IF NOT _has_consent THEN
    RAISE EXCEPTION 'Cannot advance enrollment without a signed consent record'
      USING ERRCODE = 'P0001';
  END IF;

  -- Only valid forward transitions
  IF _enrollment.status NOT IN ('eligible', 'screening') THEN
    -- Idempotent: if already active/consented/completed, return as-is
    IF _enrollment.status IN ('consented', 'active', 'completed') THEN
      RETURN _enrollment;
    END IF;
    RAISE EXCEPTION 'Cannot advance enrollment from status %', _enrollment.status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.study_enrollments
  SET status = 'active',
      enrolled_at = COALESCE(enrolled_at, now())
  WHERE id = _enrollment_id
  RETURNING * INTO _enrollment;

  RETURN _enrollment;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_enrollment_after_consent(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.advance_enrollment_after_consent(uuid) TO authenticated;

-- Allow withdrawal by admins via a dedicated function (kept separate from above)
CREATE OR REPLACE FUNCTION public.withdraw_enrollment(_enrollment_id uuid, _reason text)
RETURNS public.study_enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enrollment public.study_enrollments;
BEGIN
  SELECT * INTO _enrollment FROM public.study_enrollments WHERE id = _enrollment_id;
  IF _enrollment.id IS NULL THEN
    RAISE EXCEPTION 'Enrollment not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_assigned_clinician(auth.uid(), _enrollment.profile_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR _enrollment.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.study_enrollments
  SET status = 'withdrawn',
      withdrawn_at = now(),
      withdrawal_reason = _reason
  WHERE id = _enrollment_id
  RETURNING * INTO _enrollment;

  RETURN _enrollment;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_enrollment(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.withdraw_enrollment(uuid, text) TO authenticated;