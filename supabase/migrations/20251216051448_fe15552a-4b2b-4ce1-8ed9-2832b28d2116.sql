-- Add fluency diagnostic columns to utterance_analyses

-- 1) Add columns (using text instead of enum for flexibility with existing codebase)
ALTER TABLE utterance_analyses
  ADD COLUMN IF NOT EXISTS fluency_available boolean,
  ADD COLUMN IF NOT EXISTS fluency_unavailable_reason text;

-- 2) Index for dashboard queries on created_at (if not exists)
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_created_at
  ON utterance_analyses (created_at);

-- 3) Integrity constraint: if fluency_available is true, reason should be null; if false, reason should be non-null
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'utterance_analyses_fluency_reason_check'
  ) THEN
    ALTER TABLE utterance_analyses
      ADD CONSTRAINT utterance_analyses_fluency_reason_check
      CHECK (
        (fluency_available IS NULL)
        OR (fluency_available = true AND fluency_unavailable_reason IS NULL)
        OR (fluency_available = false AND fluency_unavailable_reason IS NOT NULL)
      );
  END IF;
END
$$;

-- 4) Add comment for documentation
COMMENT ON COLUMN utterance_analyses.fluency_available IS 'Whether fluency metrics (speech_rate_wpm, pause_count, etc.) were successfully captured';
COMMENT ON COLUMN utterance_analyses.fluency_unavailable_reason IS 'Reason fluency metrics are missing: no_recording, no_session, not_authed, permission_denied, recorder_error, analysis_error';