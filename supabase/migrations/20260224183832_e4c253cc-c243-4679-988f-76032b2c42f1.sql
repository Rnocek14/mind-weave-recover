
-- Add acknowledgment fields to recovery_alerts
ALTER TABLE public.recovery_alerts
  ADD COLUMN acknowledged_at timestamptz,
  ADD COLUMN acknowledged_by uuid,
  ADD COLUMN acknowledgement_notes text;
