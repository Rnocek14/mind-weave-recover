-- Add engagement tracking to exercise_events
ALTER TABLE exercise_events ADD COLUMN IF NOT EXISTS engagement_flags JSONB DEFAULT '{}'::jsonb;

-- Create index for querying high frustration/fatigue sessions
CREATE INDEX IF NOT EXISTS idx_exercise_events_engagement 
ON exercise_events USING GIN (engagement_flags);

-- Create engagement interventions tracking table
CREATE TABLE IF NOT EXISTS engagement_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL, -- 'frustration', 'fatigue', 'plateau', 'error_streak'
  intervention TEXT NOT NULL, -- 'difficulty_down', 'break_prompt', 'confidence_boost', 'session_end'
  user_action TEXT, -- 'accepted', 'dismissed', 'ignored', NULL if not yet acted upon
  trigger_data JSONB DEFAULT '{}'::jsonb, -- Store signals that triggered intervention
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on engagement_interventions
ALTER TABLE engagement_interventions ENABLE ROW LEVEL SECURITY;

-- Users can view their own interventions
CREATE POLICY "Users access own interventions"
ON engagement_interventions
FOR ALL
USING (session_id IN (
  SELECT id FROM sessions WHERE user_id = auth.uid()
));

-- Create index for querying interventions by session
CREATE INDEX IF NOT EXISTS idx_engagement_interventions_session 
ON engagement_interventions(session_id, created_at DESC);

-- Create index for analyzing intervention effectiveness
CREATE INDEX IF NOT EXISTS idx_engagement_interventions_type 
ON engagement_interventions(trigger_type, user_action);