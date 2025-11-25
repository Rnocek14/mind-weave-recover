-- Add trial count tracking to recovery_summaries
ALTER TABLE recovery_summaries 
ADD COLUMN IF NOT EXISTS trial_count_at_generation INTEGER DEFAULT 0;

COMMENT ON COLUMN recovery_summaries.trial_count_at_generation IS 'Total trial count when this summary was generated, used to track when 20+ new trials warrant regeneration';