-- Create dedicated shadow_events table for research/analytics
-- This captures real-time system decisions vs outcomes

CREATE TABLE public.shadow_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.profiles(id),
  session_id UUID REFERENCES public.sessions(id),
  attempt_id UUID, -- Links to utterance_analyses.attempt_id
  
  -- When
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Task context
  task_type TEXT NOT NULL, -- 'photo_naming', 'phrase_practice', 'two_clues', etc.
  domain TEXT, -- 'semantic', 'phonological', 'sentence', etc.
  interaction_mode TEXT DEFAULT 'independent', -- 'independent', 'cued', 'modeled'
  target_word TEXT,
  target_phrase TEXT,
  
  -- System decision (what the AI planned)
  system_guess TEXT, -- e.g. 'correct', 'phonemic_error', 'semantic_error'
  system_action TEXT, -- e.g. 'advance', 'offer_cue', 'step_down'
  system_confidence NUMERIC, -- 0.0-1.0
  
  -- Actual outcome
  user_spoke BOOLEAN,
  user_transcript TEXT,
  outcome_correct BOOLEAN,
  outcome_error_type TEXT,
  latency_ms INTEGER,
  
  -- Structured analysis
  analysis_data JSONB DEFAULT '{}'::jsonb, -- utterance analysis payload
  task_data JSONB DEFAULT '{}'::jsonb -- task-specific context (clues, anchors, etc.)
);

-- Enable RLS
ALTER TABLE public.shadow_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own shadow events
CREATE POLICY "Users can insert own shadow events"
  ON public.shadow_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own shadow events
CREATE POLICY "Users can view own shadow events"
  ON public.shadow_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all shadow events for research
CREATE POLICY "Admins can view all shadow events"
  ON public.shadow_events
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for analytics queries
CREATE INDEX idx_shadow_events_user_created ON public.shadow_events(user_id, created_at DESC);
CREATE INDEX idx_shadow_events_session ON public.shadow_events(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_shadow_events_task_type ON public.shadow_events(task_type);
CREATE INDEX idx_shadow_events_outcome ON public.shadow_events(outcome_correct) WHERE outcome_correct IS NOT NULL;

COMMENT ON TABLE public.shadow_events IS 'Captures system predictions vs actual user outcomes for ML training and therapy optimization research';