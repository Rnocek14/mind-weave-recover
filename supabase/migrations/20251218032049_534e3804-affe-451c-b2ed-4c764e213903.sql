-- Add cue_trigger column to exercise_events (was missing from previous migration)
ALTER TABLE exercise_events ADD COLUMN IF NOT EXISTS cue_trigger text;

COMMENT ON COLUMN exercise_events.cue_trigger IS 'What triggered the cue: stall, consecutive_errors, or user_request';