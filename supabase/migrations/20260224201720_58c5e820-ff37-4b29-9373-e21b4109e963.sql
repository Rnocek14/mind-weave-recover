
-- Physical daily metrics: objective device-sourced signals
-- Follows localYYYYMMDD date pattern for consistency with dose_logs/daily_readiness
CREATE TABLE public.physical_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  user_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  steps INTEGER,
  active_minutes NUMERIC,
  workout_minutes NUMERIC,
  resting_hr SMALLINT,
  sleep_minutes NUMERIC,
  source TEXT NOT NULL DEFAULT 'manual',  -- healthkit | googlefit | manual
  import_id TEXT,  -- dedup key for device imports
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, metric_date, source)
);

-- Enable RLS
ALTER TABLE public.physical_daily_metrics ENABLE ROW LEVEL SECURITY;

-- Users manage own metrics via profile
CREATE POLICY "Users manage own physical metrics via profile"
  ON public.physical_daily_metrics
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = physical_daily_metrics.profile_id
      AND profiles.user_id = auth.uid()
  ));

-- Admins can view all
CREATE POLICY "Admins can view all physical metrics"
  ON public.physical_daily_metrics
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for timeline queries
CREATE INDEX idx_physical_daily_metrics_profile_date
  ON public.physical_daily_metrics (profile_id, metric_date);

-- Trigger for updated_at
CREATE TRIGGER update_physical_daily_metrics_updated_at
  BEFORE UPDATE ON public.physical_daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
