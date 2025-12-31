-- Add pronunciation diagnostics columns for structured error tracking
ALTER TABLE utterance_analyses 
ADD COLUMN IF NOT EXISTS pron_request_id uuid,
ADD COLUMN IF NOT EXISTS pronunciation_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS pronunciation_error_stage text,
ADD COLUMN IF NOT EXISTS pronunciation_timings_ms jsonb,
ADD COLUMN IF NOT EXISTS audio_meta jsonb;

-- Add index for stuck-job watchdog queries
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_pron_status_created 
ON utterance_analyses (pronunciation_status, created_at) 
WHERE pronunciation_status IN ('pending', 'failed');

-- Add index for correlation ID lookups
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_pron_request_id 
ON utterance_analyses (pron_request_id) 
WHERE pron_request_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN utterance_analyses.pron_request_id IS 'Correlation ID for tracing pronunciation analysis through all stages';
COMMENT ON COLUMN utterance_analyses.pronunciation_status IS 'pending | complete | failed | skipped';
COMMENT ON COLUMN utterance_analyses.pronunciation_error_stage IS 'wav_conversion | base64_encoding | edge_function | azure_api | unexpected';
COMMENT ON COLUMN utterance_analyses.pronunciation_timings_ms IS '{ wav, base64, edge, total }';
COMMENT ON COLUMN utterance_analyses.audio_meta IS '{ original_mime, original_size, wav_size, base64_len }';