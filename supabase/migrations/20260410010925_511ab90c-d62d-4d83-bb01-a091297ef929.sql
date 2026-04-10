-- Add provenance and future-proofing columns to shadow_events
ALTER TABLE public.shadow_events
  ADD COLUMN IF NOT EXISTS model_version text,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'shadow',
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cue_type_candidate text,
  ADD COLUMN IF NOT EXISTS trigger_reason text,
  ADD COLUMN IF NOT EXISTS asr_confidence numeric,
  ADD COLUMN IF NOT EXISTS user_self_recovered boolean,
  ADD COLUMN IF NOT EXISTS environment text;

-- Add index for review workflow queries
CREATE INDEX IF NOT EXISTS idx_shadow_events_review_status ON public.shadow_events(review_status) WHERE review_status != 'pending';

-- Add index for source_type filtering
CREATE INDEX IF NOT EXISTS idx_shadow_events_source_type ON public.shadow_events(source_type);

-- Add composite index for user + time range queries (research/analytics)
CREATE INDEX IF NOT EXISTS idx_shadow_events_user_created ON public.shadow_events(user_id, created_at DESC);