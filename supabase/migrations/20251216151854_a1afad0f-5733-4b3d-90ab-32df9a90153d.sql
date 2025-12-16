-- 1. Create worker_heartbeats table for monitoring
CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
  worker_id TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ok',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Allow service role to manage heartbeats (no RLS needed - admin only)
ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view worker heartbeats"
ON public.worker_heartbeats
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Update claim_speech_analysis_jobs to handle NULL next_retry_at and reclaim stale locks
CREATE OR REPLACE FUNCTION public.claim_speech_analysis_jobs(p_worker_id text, p_batch_size integer DEFAULT 5)
RETURNS TABLE(attempt_id uuid, audio_storage_path text, target_word text, transcript text, analysis_version text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT ua.attempt_id
    FROM utterance_analyses ua
    WHERE (
      -- Normal pending jobs
      (ua.analysis_status = 'pending' AND COALESCE(ua.next_retry_at, now()) <= now())
      -- OR stale processing jobs (stuck > 10 minutes)
      OR (ua.analysis_status = 'processing' AND ua.locked_at < now() - interval '10 minutes')
    )
    AND ua.audio_storage_path IS NOT NULL
    ORDER BY ua.analysis_priority DESC, COALESCE(ua.next_retry_at, ua.created_at) ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE utterance_analyses ua
  SET 
    analysis_status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    -- Increment retry count if reclaiming stale job
    retry_count = CASE WHEN ua.analysis_status = 'processing' THEN ua.retry_count + 1 ELSE ua.retry_count END
  FROM claimed c
  WHERE ua.attempt_id = c.attempt_id
  RETURNING 
    ua.attempt_id,
    ua.audio_storage_path,
    ua.target_word,
    ua.transcript,
    ua.analysis_version;
END;
$function$;

-- 3. Update submit_speech_analysis_result to enforce "complete only when payload exists"
CREATE OR REPLACE FUNCTION public.submit_speech_analysis_result(
  p_attempt_id uuid, 
  p_worker_id text, 
  p_success boolean, 
  p_alignment_data jsonb DEFAULT NULL, 
  p_gop_data jsonb DEFAULT NULL, 
  p_asr_warning_flags text[] DEFAULT NULL, 
  p_speech_ratio double precision DEFAULT NULL, 
  p_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated BOOLEAN;
  v_has_payload BOOLEAN;
BEGIN
  -- Check if we actually have alignment data (required for "complete")
  v_has_payload := (p_alignment_data IS NOT NULL);
  
  IF p_success AND v_has_payload THEN
    -- Only mark complete if we have alignment data
    UPDATE utterance_analyses
    SET 
      analysis_status = 'complete',
      alignment_data = p_alignment_data,
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
  ELSIF p_success AND NOT v_has_payload THEN
    -- Claimed success but no payload = failed
    UPDATE utterance_analyses
    SET 
      analysis_status = 'failed',
      error_message = COALESCE(p_error_message, 'Worker reported success but no alignment data'),
      retry_count = retry_count + 1,
      next_retry_at = now() + (interval '1 minute' * power(2, retry_count)),
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
    WHERE attempt_id = p_attempt_id
      AND locked_by = p_worker_id
      AND analysis_status = 'processing';
  ELSE
    -- Explicit failure with exponential backoff, cap at 5 retries
    UPDATE utterance_analyses
    SET 
      analysis_status = CASE WHEN retry_count >= 5 THEN 'failed' ELSE 'pending' END,
      error_message = p_error_message,
      retry_count = retry_count + 1,
      next_retry_at = CASE 
        WHEN retry_count >= 5 THEN NULL 
        ELSE now() + (interval '1 minute' * power(2, LEAST(retry_count, 6)))
      END,
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
$function$;

-- 4. Function to upsert worker heartbeat (called by worker)
CREATE OR REPLACE FUNCTION public.upsert_worker_heartbeat(
  p_worker_id text,
  p_status text DEFAULT 'ok',
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  INSERT INTO worker_heartbeats (worker_id, last_seen, status, meta)
  VALUES (p_worker_id, now(), p_status, p_meta)
  ON CONFLICT (worker_id) DO UPDATE
  SET last_seen = now(),
      status = excluded.status,
      meta = excluded.meta;
$function$;