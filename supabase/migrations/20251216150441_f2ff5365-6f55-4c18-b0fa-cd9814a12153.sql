-- Fix the column default to 'pending' instead of 'complete'
ALTER TABLE utterance_analyses 
ALTER COLUMN analysis_status SET DEFAULT 'pending';

-- Backfill existing rows with audio that need MFA processing
UPDATE utterance_analyses
SET analysis_status = 'pending',
    next_retry_at = now()
WHERE audio_storage_path IS NOT NULL
  AND alignment_data IS NULL
  AND gop_data IS NULL
  AND analysis_status = 'complete';