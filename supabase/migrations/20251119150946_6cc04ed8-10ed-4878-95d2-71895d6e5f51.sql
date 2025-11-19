-- Add caregiver notes column to sessions table
ALTER TABLE sessions 
ADD COLUMN caregiver_notes text;

COMMENT ON COLUMN sessions.caregiver_notes IS 
  'Optional qualitative notes from caregiver about session context (mood, engagement, challenges)';