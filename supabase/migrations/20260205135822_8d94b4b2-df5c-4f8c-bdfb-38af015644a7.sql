-- Create adaptation_events table for logging in-game and session-level adaptations
CREATE TABLE adaptation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  exercise_slug TEXT,
  trial_index INTEGER,
  
  -- Adaptation type and layer
  adaptation_type TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('session', 'in_game')),
  
  -- Before/after values
  value_before JSONB,
  value_after JSONB,
  
  -- Trigger information
  trigger_type TEXT NOT NULL,
  trigger_rule_id TEXT,
  trigger_condition TEXT,
  
  -- Evidence that justified this adaptation
  evidence JSONB NOT NULL DEFAULT '{}',
  confidence TEXT NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for timeline queries (user + time)
CREATE INDEX idx_adaptation_events_user_time ON adaptation_events(user_id, created_at DESC);

-- Index for session queries  
CREATE INDEX idx_adaptation_events_session ON adaptation_events(session_id) WHERE session_id IS NOT NULL;

-- Index for exercise-specific queries
CREATE INDEX idx_adaptation_events_exercise ON adaptation_events(exercise_slug, created_at DESC) WHERE exercise_slug IS NOT NULL;

-- Enable RLS
ALTER TABLE adaptation_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own adaptation events
CREATE POLICY "Users can view own adaptation events"
  ON adaptation_events FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own adaptation events
CREATE POLICY "Users can insert own adaptation events"
  ON adaptation_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all adaptation events (for research/QA)
CREATE POLICY "Admins can view all adaptation events"
  ON adaptation_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));