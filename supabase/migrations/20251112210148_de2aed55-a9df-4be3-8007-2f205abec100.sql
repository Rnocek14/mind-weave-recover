-- Phase 1: Rich Telemetry Foundation
-- Add granular per-trial tracking columns to exercise_events

ALTER TABLE exercise_events 
  ADD COLUMN IF NOT EXISTS reaction_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS cue_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_type TEXT,
  ADD COLUMN IF NOT EXISTS task_parameters JSONB DEFAULT '{}'::jsonb;

-- Add mood tracking to sessions for emotional domain (Phase 6 prep)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS mood_rating INTEGER CHECK (mood_rating BETWEEN 1 AND 5);

-- Add comments for clarity
COMMENT ON COLUMN exercise_events.reaction_time_ms IS 'Time from stimulus to response in milliseconds';
COMMENT ON COLUMN exercise_events.cue_level IS '0=none, 1=semantic, 2=phonemic, 3=full';
COMMENT ON COLUMN exercise_events.error_type IS 'e.g. semantic_related, phonological, omission, spatial_miss';
COMMENT ON COLUMN exercise_events.task_parameters IS 'Captures difficulty state: {distractors: 5, target_size: large, time_limit: 5000}';
COMMENT ON COLUMN sessions.mood_rating IS 'Post-session mood: 1=very negative to 5=very positive';