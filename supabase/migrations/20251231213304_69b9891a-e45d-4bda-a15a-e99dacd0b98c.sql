-- Add ended_reason column for QA tracking
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS ended_reason text;

-- Add constraint for valid values
ALTER TABLE sessions 
ADD CONSTRAINT sessions_ended_reason_check 
CHECK (ended_reason IS NULL OR ended_reason IN ('completed', 'abandoned', 'pagehide', 'visibility_timeout', 'unmount', 'manual'));

-- Create index for finding orphaned sessions
CREATE INDEX IF NOT EXISTS idx_sessions_ended_at_null 
ON sessions (started_at) 
WHERE ended_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN sessions.ended_reason IS 'Why the session ended: completed, abandoned, pagehide, visibility_timeout, unmount, manual';