-- Add cue_trigger column to utterance_analyses for tracking what initiated the cue
ALTER TABLE public.utterance_analyses
ADD COLUMN IF NOT EXISTS cue_trigger text;

-- Add comment for documentation
COMMENT ON COLUMN public.utterance_analyses.cue_trigger IS 'What triggered the cue: stall, consecutive_errors, or user_request';