
CREATE TABLE public.adaptation_trial_log_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warn','error')),
  scope text NOT NULL CHECK (scope IN ('trial','session','user_slug_window')),
  trial_log_id uuid NULL REFERENCES public.adaptation_trial_logs(id) ON DELETE CASCADE,
  session_id uuid NULL,
  user_id uuid NULL,
  exercise_slug text NULL,
  window_label text NULL,
  scope_ref_hash text NOT NULL,
  observed jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected jsonb NOT NULL DEFAULT '{}'::jsonb,
  checklist_version text NOT NULL DEFAULT '0.1',
  detector_run_id uuid NULL,
  resolved_at timestamptz NULL,
  resolution_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX adaptation_trial_log_anomalies_dedupe
  ON public.adaptation_trial_log_anomalies (rule_id, scope, scope_ref_hash);

CREATE INDEX adaptation_trial_log_anomalies_unresolved_severity
  ON public.adaptation_trial_log_anomalies (severity, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX adaptation_trial_log_anomalies_slug
  ON public.adaptation_trial_log_anomalies (exercise_slug, created_at DESC);

CREATE INDEX adaptation_trial_log_anomalies_user
  ON public.adaptation_trial_log_anomalies (user_id, created_at DESC);

CREATE TRIGGER adaptation_trial_log_anomalies_updated_at
  BEFORE UPDATE ON public.adaptation_trial_log_anomalies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.adaptation_trial_log_anomalies ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins manage anomalies"
ON public.adaptation_trial_log_anomalies
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Assigned clinicians: read anomalies for their patients
CREATE POLICY "Clinicians view anomalies for assigned patients"
ON public.adaptation_trial_log_anomalies
FOR SELECT
TO authenticated
USING (
  user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = adaptation_trial_log_anomalies.user_id
      AND public.is_assigned_clinician(auth.uid(), p.id)
  )
);

-- Detector run log (lightweight)
CREATE TABLE public.adaptation_anomaly_detector_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL,
  trials_scanned integer NOT NULL DEFAULT 0,
  anomalies_written integer NOT NULL DEFAULT 0,
  anomalies_skipped_dup integer NOT NULL DEFAULT 0,
  checklist_version text NOT NULL DEFAULT '0.1',
  notes text NULL
);

ALTER TABLE public.adaptation_anomaly_detector_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view detector runs"
ON public.adaptation_anomaly_detector_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
