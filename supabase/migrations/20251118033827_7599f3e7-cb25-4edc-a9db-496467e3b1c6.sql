-- Create capability_assessments table for zero-assumption baseline testing
CREATE TABLE public.capability_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  assessment_version TEXT DEFAULT 'v1.0' NOT NULL,
  
  -- Raw capability scores (0-10 scale)
  vision_score INTEGER CHECK (vision_score >= 0 AND vision_score <= 10),
  motor_score INTEGER CHECK (motor_score >= 0 AND motor_score <= 10),
  attention_score INTEGER CHECK (attention_score >= 0 AND attention_score <= 10),
  
  -- Behavioral capability flags
  can_orient BOOLEAN DEFAULT false,
  can_tap BOOLEAN DEFAULT false,
  understands_cause_effect BOOLEAN DEFAULT false,
  can_match_patterns BOOLEAN DEFAULT false,
  
  -- Trial-level data for research and analytics
  trial_data JSONB DEFAULT '{}'::jsonb,
  
  -- Graceful exit tracking
  completed BOOLEAN DEFAULT false,
  needs_retry BOOLEAN DEFAULT false,
  retry_reason TEXT,
  
  -- Confidence metrics
  confidence_score NUMERIC(4,3) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Clinical context at time of assessment
  clinical_snapshot JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add capability profile reference to profiles
ALTER TABLE public.profiles 
ADD COLUMN capability_profile_id UUID REFERENCES public.capability_assessments(id);

-- Enable RLS
ALTER TABLE public.capability_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own capability assessments"
  ON public.capability_assessments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own capability assessments"
  ON public.capability_assessments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own capability assessments"
  ON public.capability_assessments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all capability assessments"
  ON public.capability_assessments
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for efficient queries
CREATE INDEX idx_capability_assessments_user_date 
  ON public.capability_assessments(user_id, assessed_at DESC);

CREATE INDEX idx_capability_assessments_completed 
  ON public.capability_assessments(user_id, completed) 
  WHERE completed = true;

-- GIN index for trial data queries
CREATE INDEX idx_capability_assessments_trial_data 
  ON public.capability_assessments USING GIN(trial_data);

COMMENT ON TABLE public.capability_assessments IS 'Zero-assumption baseline capability testing - assesses vision, motor, attention without requiring speech or comprehension';
COMMENT ON COLUMN public.capability_assessments.vision_score IS 'Visual orientation and target detection ability (0-10)';
COMMENT ON COLUMN public.capability_assessments.motor_score IS 'Motor control, tap accuracy, and response time (0-10)';
COMMENT ON COLUMN public.capability_assessments.attention_score IS 'Sustained attention and task consistency (0-10)';
COMMENT ON COLUMN public.capability_assessments.trial_data IS 'Raw trial-level responses for research export';
COMMENT ON COLUMN public.capability_assessments.retry_reason IS 'Why assessment was paused: fatigue_suspected, no_response, distress_observed, technical_issue';