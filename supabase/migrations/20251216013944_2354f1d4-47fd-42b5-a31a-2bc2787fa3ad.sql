-- Add status and advanced speech analysis columns to utterance_analyses
ALTER TABLE public.utterance_analyses 
ADD COLUMN IF NOT EXISTS recording_duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS avg_pause_duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS reasoning TEXT,
ADD COLUMN IF NOT EXISTS category TEXT;

-- Update utterance_analyses for MFA/GOP pipeline support
-- Status for async processing workflow
ALTER TABLE public.utterance_analyses
ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'complete';

-- Alignment data (MFA output)
ALTER TABLE public.utterance_analyses
ADD COLUMN IF NOT EXISTS alignment_data JSONB;

-- GOP pronunciation scoring
ALTER TABLE public.utterance_analyses
ADD COLUMN IF NOT EXISTS gop_data JSONB;

-- ASR warning flags for reliability tracking
ALTER TABLE public.utterance_analyses
ADD COLUMN IF NOT EXISTS asr_warning_flags TEXT[];

-- Speech ratio (speech time / total duration) for hallucination detection
ALTER TABLE public.utterance_analyses
ADD COLUMN IF NOT EXISTS speech_ratio FLOAT;

-- Review workflow
ALTER TABLE public.utterance_analyses
ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'unreviewed';

-- Human labels for validation/training
ALTER TABLE public.utterance_analyses
ADD COLUMN IF NOT EXISTS human_labels JSONB;

-- Add index for analysis status (for worker job polling)
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_status 
ON public.utterance_analyses (analysis_status) 
WHERE analysis_status IN ('pending', 'processing');

-- Add index for review workflow
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_review 
ON public.utterance_analyses (review_status) 
WHERE review_status = 'needs_review';

-- Comment for documentation
COMMENT ON COLUMN public.utterance_analyses.analysis_status IS 'pending|processing|complete|failed - for async MFA/GOP pipeline';
COMMENT ON COLUMN public.utterance_analyses.alignment_data IS 'MFA alignment output: word_timestamps, phoneme_timestamps, alignment_quality';
COMMENT ON COLUMN public.utterance_analyses.gop_data IS 'GOP pronunciation scores: gop_mean, gop_min, gop_by_phoneme, mispronounced_phonemes';
COMMENT ON COLUMN public.utterance_analyses.asr_warning_flags IS 'Reliability flags: low_confidence, high_silence_ratio, possible_hallucination';
COMMENT ON COLUMN public.utterance_analyses.review_status IS 'unreviewed|needs_review|reviewed - for clinical validation workflow';