-- Add cue efficacy tracking fields to exercise_events
ALTER TABLE exercise_events 
ADD COLUMN IF NOT EXISTS cue_type_given TEXT,
ADD COLUMN IF NOT EXISTS cue_was_effective BOOLEAN,
ADD COLUMN IF NOT EXISTS time_to_success_after_cue_ms INTEGER;

COMMENT ON COLUMN exercise_events.cue_type_given IS 'Type of cue shown: none, semantic, phonemic, full_word';
COMMENT ON COLUMN exercise_events.cue_was_effective IS 'Did user succeed after receiving this cue?';
COMMENT ON COLUMN exercise_events.time_to_success_after_cue_ms IS 'Milliseconds from cue shown to correct response';

-- Create user_speech_profiles table for personalized co-pilot data
CREATE TABLE IF NOT EXISTS user_speech_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Error patterns
  error_type_distribution JSONB DEFAULT '{}'::jsonb,
  most_challenging_categories JSONB DEFAULT '[]'::jsonb,
  
  -- Phoneme patterns
  phoneme_difficulty_map JSONB DEFAULT '{}'::jsonb,
  common_substitutions JSONB DEFAULT '[]'::jsonb,
  
  -- Circumlocution templates
  known_circumlocutions JSONB DEFAULT '[]'::jsonb,
  
  -- Cue efficacy (key data for personalized cueing)
  cue_efficacy_by_type JSONB DEFAULT '{}'::jsonb,
  cue_efficacy_by_category JSONB DEFAULT '{}'::jsonb,
  
  -- Stall patterns & fluency baseline
  avg_stall_duration_ms INTEGER,
  common_stall_markers TEXT[],
  baseline_wpm NUMERIC,
  baseline_pause_frequency NUMERIC,
  effortful_speech_rate NUMERIC,
  
  -- Bookkeeping
  last_computed_at TIMESTAMPTZ DEFAULT now(),
  trial_count_at_computation INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, profile_id)
);

-- Enable RLS
ALTER TABLE user_speech_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users manage their own speech profiles
CREATE POLICY "Users manage own speech profiles via profile"
ON user_speech_profiles FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = user_speech_profiles.profile_id 
  AND profiles.user_id = auth.uid()
));

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_speech_profiles_user_profile 
ON user_speech_profiles(user_id, profile_id);

-- Index on cue_type_given for analytics queries
CREATE INDEX IF NOT EXISTS idx_exercise_events_cue_type 
ON exercise_events(cue_type_given) 
WHERE cue_type_given IS NOT NULL;