-- learning_rates: record how many distinct practice days the regression saw.
--
-- The hub gates trend arrows and triage tiers on evidence (trials AND days);
-- confidence_score blends the two into one number that cannot be unpicked.
-- Rows written before this column exists carry NULL and are not shown as a
-- trend until calculate-learning-rates runs again.
ALTER TABLE public.learning_rates ADD COLUMN IF NOT EXISTS active_days integer;
