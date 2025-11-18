-- Week 1: Safety & Mood Tracking Infrastructure

-- 1. Add dismissed flags tracking
CREATE TABLE IF NOT EXISTS dismissed_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  flag_severity TEXT NOT NULL,
  flag_details JSONB NOT NULL DEFAULT '{}',
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  UNIQUE(user_id, flag_type, dismissed_at)
);

CREATE INDEX idx_dismissed_flags_user ON dismissed_flags(user_id, dismissed_at DESC);

ALTER TABLE dismissed_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own dismissed flags" 
  ON dismissed_flags FOR ALL 
  USING (auth.uid() = user_id);

-- 2. Add dose cap enforcement fields to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS daily_cap_minutes INTEGER DEFAULT 45,
ADD COLUMN IF NOT EXISTS session_cap_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS enforce_dose_caps BOOLEAN DEFAULT true;

-- 3. Add post-session mood to sessions summary
-- sessions.mood_rating already exists for pre-session mood
-- We'll add post_mood to the summary jsonb field

COMMENT ON COLUMN profiles.daily_cap_minutes IS 'Maximum practice minutes per day (safety limit)';
COMMENT ON COLUMN profiles.session_cap_minutes IS 'Maximum minutes per individual session';
COMMENT ON COLUMN profiles.enforce_dose_caps IS 'Whether to enforce dose cap limits';
COMMENT ON COLUMN sessions.mood_rating IS 'Pre-session mood rating (1-5 scale)';