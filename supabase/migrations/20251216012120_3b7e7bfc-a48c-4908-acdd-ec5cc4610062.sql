-- Add attempt_id column to exercise_events for deduplication
ALTER TABLE public.exercise_events 
ADD COLUMN IF NOT EXISTS attempt_id UUID DEFAULT gen_random_uuid();

-- Add trial_index for fatigue pattern analysis
ALTER TABLE public.exercise_events 
ADD COLUMN IF NOT EXISTS trial_index INTEGER;

-- Add attempt_number for retry tracking (1 = first try, 2 = after cue, etc.)
ALTER TABLE public.exercise_events 
ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;

-- Add browser_transcript as separate field (so whisper_transcript stays clean)
ALTER TABLE public.exercise_events 
ADD COLUMN IF NOT EXISTS browser_transcript TEXT;

-- Create utterance_analyses table for clean analytics
CREATE TABLE IF NOT EXISTS public.utterance_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.sessions(id),
  exercise_slug TEXT,
  
  -- Trial context
  trial_index INTEGER,
  attempt_number INTEGER DEFAULT 1,
  target_word TEXT NOT NULL,
  category TEXT,
  
  -- Transcript data
  transcript TEXT,
  transcript_source TEXT CHECK (transcript_source IN ('browser', 'whisper', 'manual')),
  asr_confidence DOUBLE PRECISION,
  
  -- Classification
  is_correct BOOLEAN,
  error_type TEXT,
  phonological_similarity DOUBLE PRECISION,
  semantic_similarity DOUBLE PRECISION,
  classification_confidence DOUBLE PRECISION,
  reasoning TEXT,
  
  -- Fluency metrics
  speech_rate_wpm DOUBLE PRECISION,
  pause_count INTEGER,
  total_pause_ms INTEGER,
  avg_pause_duration_ms INTEGER,
  effortful_speech BOOLEAN,
  
  -- Cue context
  cue_type_given TEXT,
  cue_was_effective BOOLEAN,
  time_to_success_after_cue_ms INTEGER,
  
  -- Timing
  latency_ms INTEGER,
  recording_duration_ms INTEGER,
  
  -- Audio reference
  audio_storage_path TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on attempt_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_attempt_id ON public.utterance_analyses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_user_id ON public.utterance_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_session_id ON public.utterance_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_target ON public.utterance_analyses(target_word);
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_error_type ON public.utterance_analyses(error_type);

-- Enable RLS
ALTER TABLE public.utterance_analyses ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access their own utterance analyses
CREATE POLICY "Users access own utterance analyses"
ON public.utterance_analyses
FOR ALL
USING (auth.uid() = user_id);

-- Admin access policy
CREATE POLICY "Admins can view all utterance analyses"
ON public.utterance_analyses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_utterance_analyses_updated_at
BEFORE UPDATE ON public.utterance_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();