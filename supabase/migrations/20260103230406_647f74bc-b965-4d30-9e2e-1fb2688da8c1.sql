-- Add stuck_type column to utterance_analyses for classifying attempt outcomes
ALTER TABLE public.utterance_analyses 
ADD COLUMN IF NOT EXISTS stuck_type text;

-- Create thought_decision_logs table for logging adaptive prompt selection decisions
CREATE TABLE public.thought_decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  logged_at timestamptz NOT NULL DEFAULT now(),
  
  -- What was selected
  prompt_id text,
  prompt_text text NOT NULL,
  prompt_intent_type text,
  prompt_theme text,
  prompt_difficulty_tier integer,
  
  -- Why it was selected
  selection_reason text NOT NULL,
  previous_stuck_type text,
  session_attempt_count integer DEFAULT 0,
  session_completion_count integer DEFAULT 0,
  session_avg_latency_ms float,
  
  -- Session-level context at decision time
  narrowing_levels_used integer[] DEFAULT '{}',
  stuck_type_history text[] DEFAULT '{}',
  
  -- Outcome (updated after attempt)
  outcome_stuck_type text,
  outcome_did_speak boolean,
  outcome_latency_ms float,
  outcome_utterance_complete boolean,
  
  CONSTRAINT unique_thought_decision_per_attempt UNIQUE (session_id, prompt_id, logged_at)
);

-- Enable RLS
ALTER TABLE public.thought_decision_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own thought decision logs"
ON public.thought_decision_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own thought decision logs"
ON public.thought_decision_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own thought decision logs"
ON public.thought_decision_logs FOR UPDATE
USING (auth.uid() = user_id);

-- Index for querying user's decision history
CREATE INDEX idx_thought_decision_logs_user_date 
ON public.thought_decision_logs(user_id, log_date DESC);

CREATE INDEX idx_thought_decision_logs_session 
ON public.thought_decision_logs(session_id);

-- Add comment for documentation
COMMENT ON TABLE public.thought_decision_logs IS 'Logs adaptive prompt selection decisions for Thought Continuation game - what prompt was selected and why';