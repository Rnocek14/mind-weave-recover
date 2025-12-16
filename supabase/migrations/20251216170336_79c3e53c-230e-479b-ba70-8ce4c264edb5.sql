-- Reset pending jobs so they're claimable immediately
UPDATE utterance_analyses
SET
  next_retry_at = now(),
  error_message = null
WHERE analysis_status = 'pending'
  AND audio_storage_path IS NOT NULL
  AND (next_retry_at IS NULL OR next_retry_at > now())
  AND created_at >= now() - interval '48 hours';