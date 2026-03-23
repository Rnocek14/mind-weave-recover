-- Add suggested/approved statuses to clinician_overrides
-- Override lifecycle: suggested → approved → active → superseded/reversed

ALTER TABLE public.clinician_overrides DROP CONSTRAINT IF EXISTS clinician_overrides_status_check;
ALTER TABLE public.clinician_overrides ADD CONSTRAINT clinician_overrides_status_check
  CHECK (status IN ('suggested', 'approved', 'active', 'superseded', 'reversed'));

ALTER TABLE public.clinician_overrides
  ADD COLUMN IF NOT EXISTS suggested_by text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suggested_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid DEFAULT NULL;

COMMENT ON COLUMN public.clinician_overrides.suggested_by IS 'Source that suggested this override (e.g. adaptive_engine, red_flag_detection)';
COMMENT ON COLUMN public.clinician_overrides.suggested_at IS 'When the suggestion was created';
COMMENT ON COLUMN public.clinician_overrides.approved_at IS 'When a clinician approved the suggestion';
COMMENT ON COLUMN public.clinician_overrides.approved_by IS 'Clinician who approved the suggestion';