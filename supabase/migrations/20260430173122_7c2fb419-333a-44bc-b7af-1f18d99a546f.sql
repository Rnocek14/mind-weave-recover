-- Override telemetry: capture every clinician validity reclassification
CREATE TABLE public.validity_override_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id uuid NOT NULL,
  patient_user_id uuid,
  profile_id uuid,
  session_id uuid,
  attempt_id uuid,
  source_table text NOT NULL,
  original_validity_label text,
  original_counts_toward_score boolean,
  new_override text NOT NULL,
  exercise_slug text,
  validity_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.validity_override_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_validity_override_events_session ON public.validity_override_events (session_id);
CREATE INDEX idx_validity_override_events_clinician ON public.validity_override_events (clinician_id);
CREATE INDEX idx_validity_override_events_label ON public.validity_override_events (original_validity_label, new_override);

-- Clinicians insert their own override events
CREATE POLICY "Clinicians insert own override events"
  ON public.validity_override_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = clinician_id);

-- Clinicians read events they authored
CREATE POLICY "Clinicians read own override events"
  ON public.validity_override_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = clinician_id);

-- Admins read all
CREATE POLICY "Admins read all override events"
  ON public.validity_override_events
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Patients can see overrides applied to their own data (transparency)
CREATE POLICY "Patients read overrides on own data"
  ON public.validity_override_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_user_id);