-- Create adaptive_decision_logs table to audit TodayFocus decisions
CREATE TABLE public.adaptive_decision_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.profiles(id),
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Confidence and data quality
  confidence_level TEXT NOT NULL, -- 'HIGH', 'MEDIUM', 'LOW'
  trial_count INTEGER NOT NULL DEFAULT 0,
  utterance_count INTEGER NOT NULL DEFAULT 0,
  assessment_age_days INTEGER,
  
  -- Input signals snapshot
  avg_accuracy NUMERIC(5,3),
  timeout_rate NUMERIC(5,3),
  avg_reaction_time_ms INTEGER,
  semantic_error_rate NUMERIC(5,3),
  
  -- Rules that fired
  rules_fired TEXT[] NOT NULL DEFAULT '{}',
  rules_data JSONB NOT NULL DEFAULT '{}', -- Full AppliedRule[] for review
  
  -- Proposed adaptations
  adaptations JSONB NOT NULL DEFAULT '{}', -- Full ProposedAdaptations object
  
  -- Reasoning
  reasoning TEXT[] NOT NULL DEFAULT '{}',
  
  -- Constraint: one log per user per day
  UNIQUE(user_id, log_date)
);

-- Enable RLS
ALTER TABLE public.adaptive_decision_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own logs
CREATE POLICY "Users can view their own adaptive logs"
ON public.adaptive_decision_logs
FOR SELECT USING (auth.uid() = user_id);

-- System can insert logs (via service role or authenticated user)
CREATE POLICY "Users can insert their own adaptive logs"
ON public.adaptive_decision_logs
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all logs for research
CREATE POLICY "Admins can view all adaptive logs"
ON public.adaptive_decision_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Index for efficient queries
CREATE INDEX idx_adaptive_logs_user_date ON public.adaptive_decision_logs(user_id, log_date DESC);
CREATE INDEX idx_adaptive_logs_confidence ON public.adaptive_decision_logs(confidence_level);
