ALTER TABLE public.clinician_overrides
  DROP CONSTRAINT IF EXISTS clinician_overrides_status_check;

ALTER TABLE public.clinician_overrides
  ADD CONSTRAINT clinician_overrides_status_check
  CHECK (status IN ('active', 'reversed', 'superseded'));