-- Add unique constraint for upsert on manual entry
ALTER TABLE public.physical_daily_metrics
  ADD CONSTRAINT physical_daily_metrics_profile_date_source_uq
  UNIQUE (profile_id, metric_date, source);