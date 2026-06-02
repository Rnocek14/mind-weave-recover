-- Scope learning_rates uniqueness by profile so multi-profile accounts don't collide
ALTER TABLE public.learning_rates
  DROP CONSTRAINT IF EXISTS learning_rates_user_id_domain_time_window_days_end_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS learning_rates_profile_domain_window_end_key
  ON public.learning_rates (user_id, profile_id, domain, time_window_days, end_date);

CREATE INDEX IF NOT EXISTS idx_learning_rates_profile_domain
  ON public.learning_rates (profile_id, domain, calculated_at DESC);