-- Add job queue columns to utterance_analyses for Fly.io worker
ALTER TABLE public.utterance_analyses
ADD COLUMN IF NOT EXISTS analysis_version TEXT DEFAULT 'v1.0',
ADD COLUMN IF NOT EXISTS analysis_priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS locked_by TEXT,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Index for efficient job polling
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_job_queue 
ON public.utterance_analyses (analysis_priority DESC, next_retry_at ASC)
WHERE analysis_status = 'pending';

-- Index for worker lock management
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_locked
ON public.utterance_analyses (locked_by, locked_at)
WHERE analysis_status = 'processing';

-- Function to claim jobs with SKIP LOCKED (prevents double-processing)
CREATE OR REPLACE FUNCTION public.claim_speech_analysis_jobs(
  p_worker_id TEXT,
  p_batch_size INTEGER DEFAULT 5
)
RETURNS TABLE (
  attempt_id UUID,
  audio_storage_path TEXT,
  target_word TEXT,
  transcript TEXT,
  analysis_version TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT ua.attempt_id
    FROM utterance_analyses ua
    WHERE ua.analysis_status = 'pending'
      AND ua.next_retry_at <= now()
      AND ua.audio_storage_path IS NOT NULL
    ORDER BY ua.analysis_priority DESC, ua.next_retry_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE utterance_analyses ua
  SET 
    analysis_status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id
  FROM claimed c
  WHERE ua.attempt_id = c.attempt_id
  RETURNING 
    ua.attempt_id,
    ua.audio_storage_path,
    ua.target_word,
    ua.transcript,
    ua.analysis_version;
END;
$$;

-- Function to submit analysis results (worker calls this)
CREATE OR REPLACE FUNCTION public.submit_speech_analysis_result(
  p_attempt_id UUID,
  p_worker_id TEXT,
  p_success BOOLEAN,
  p_alignment_data JSONB DEFAULT NULL,
  p_gop_data JSONB DEFAULT NULL,
  p_asr_warning_flags TEXT[] DEFAULT NULL,
  p_speech_ratio FLOAT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  IF p_success THEN
    UPDATE utterance_analyses
    SET 
      analysis_status = 'complete',
      alignment_data = COALESCE(p_alignment_data, alignment_data),
      gop_data = COALESCE(p_gop_data, gop_data),
      asr_warning_flags = COALESCE(p_asr_warning_flags, asr_warning_flags),
      speech_ratio = COALESCE(p_speech_ratio, speech_ratio),
      review_status = CASE 
        WHEN p_asr_warning_flags IS NOT NULL AND array_length(p_asr_warning_flags, 1) > 0 
        THEN 'needs_review' 
        ELSE review_status 
      END,
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
    WHERE attempt_id = p_attempt_id
      AND locked_by = p_worker_id
      AND analysis_status = 'processing';
  ELSE
    UPDATE utterance_analyses
    SET 
      analysis_status = CASE WHEN retry_count >= 3 THEN 'failed' ELSE 'pending' END,
      error_message = p_error_message,
      retry_count = retry_count + 1,
      next_retry_at = now() + (interval '1 minute' * power(2, retry_count)),
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
    WHERE attempt_id = p_attempt_id
      AND locked_by = p_worker_id
      AND analysis_status = 'processing';
  END IF;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Function to release stale locks (jobs processing > 10 min)
CREATE OR REPLACE FUNCTION public.release_stale_speech_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released INTEGER;
BEGIN
  UPDATE utterance_analyses
  SET 
    analysis_status = 'pending',
    locked_at = NULL,
    locked_by = NULL,
    retry_count = retry_count + 1,
    next_retry_at = now() + interval '1 minute'
  WHERE analysis_status = 'processing'
    AND locked_at < now() - interval '10 minutes';
  
  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

-- Comments for documentation
COMMENT ON FUNCTION public.claim_speech_analysis_jobs IS 'SKIP LOCKED job claim for Fly.io speech worker - prevents double-processing';
COMMENT ON FUNCTION public.submit_speech_analysis_result IS 'Worker submits MFA/GOP results - only updates rows locked by that worker';
COMMENT ON FUNCTION public.release_stale_speech_locks IS 'Cleanup function for jobs stuck in processing > 10 min';