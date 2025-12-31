-- Add dedicated pronunciation_error_message column to avoid overloading error_message
ALTER TABLE utterance_analyses 
ADD COLUMN IF NOT EXISTS pronunciation_error_message text;

COMMENT ON COLUMN utterance_analyses.pronunciation_error_message IS 'Specific error message from pronunciation analysis pipeline';