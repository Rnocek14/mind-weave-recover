-- Clinician override for Speech Validity Gate (Phase 1 trust UX)
-- Allows clinicians to manually mark a flagged/excluded clip as a valid patient
-- attempt (or vice-versa) from the Session Review. Audit-only — does NOT
-- recompute historical scoring.

ALTER TABLE public.utterance_analyses
  ADD COLUMN IF NOT EXISTS clinician_validity_override text
    CHECK (clinician_validity_override IN ('patient','not_patient','noise','filler')),
  ADD COLUMN IF NOT EXISTS clinician_override_by uuid,
  ADD COLUMN IF NOT EXISTS clinician_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS clinician_override_note text;

ALTER TABLE public.exercise_events
  ADD COLUMN IF NOT EXISTS clinician_validity_override text
    CHECK (clinician_validity_override IN ('patient','not_patient','noise','filler')),
  ADD COLUMN IF NOT EXISTS clinician_override_by uuid,
  ADD COLUMN IF NOT EXISTS clinician_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS clinician_override_note text;

CREATE INDEX IF NOT EXISTS idx_utterance_analyses_validity_label
  ON public.utterance_analyses(session_id, validity_label);
CREATE INDEX IF NOT EXISTS idx_exercise_events_validity_label
  ON public.exercise_events(session_id, validity_label);