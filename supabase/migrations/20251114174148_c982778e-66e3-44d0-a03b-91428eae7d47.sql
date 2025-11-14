-- Add engagement summary to sessions table for caregiver dashboard
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS engagement_summary JSONB DEFAULT '{}'::jsonb;

-- Add index for faster caregiver queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_interventions_session ON engagement_interventions(session_id, created_at DESC);

COMMENT ON COLUMN sessions.engagement_summary IS 'Summary of engagement state: frustration level, fatigue level, intervention count, flags';