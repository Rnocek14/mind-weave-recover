
CREATE TABLE public.recovery_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  recovery_score numeric NOT NULL,
  accuracy_score numeric,
  latency_score numeric,
  cue_independence_score numeric,
  error_quality_score numeric,
  consistency_score numeric,
  endurance_score numeric,
  confidence_level text NOT NULL DEFAULT 'low',
  trial_count integer NOT NULL DEFAULT 0,
  session_count integer NOT NULL DEFAULT 0,
  score_version text NOT NULL DEFAULT 'v1',
  component_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profile_id, snapshot_date)
);

ALTER TABLE public.recovery_score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recovery snapshots via profile"
  ON public.recovery_score_snapshots FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = recovery_score_snapshots.profile_id
      AND profiles.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all recovery snapshots"
  ON public.recovery_score_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clinicians view assigned recovery snapshots"
  ON public.recovery_score_snapshots FOR SELECT
  TO authenticated
  USING (is_assigned_clinician(auth.uid(), profile_id));
