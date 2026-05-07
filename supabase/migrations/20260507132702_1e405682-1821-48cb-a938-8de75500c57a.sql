
-- Clinical Progression v1 — Step 1: persistence foundation
-- Per-profile per-game progression state (durable across sessions).

CREATE TABLE public.clinical_progression_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  exercise_slug text NOT NULL,
  current_level smallint NOT NULL DEFAULT 1,
  progress_pct numeric NOT NULL DEFAULT 0,
  support_baseline smallint NOT NULL DEFAULT 0,
  stable_level smallint NOT NULL DEFAULT 1,
  consecutive_success_sessions integer NOT NULL DEFAULT 0,
  consecutive_struggle_sessions integer NOT NULL DEFAULT 0,
  last_session_id uuid NULL,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_progression_level_range CHECK (current_level BETWEEN 1 AND 8),
  CONSTRAINT clinical_progression_stable_range CHECK (stable_level BETWEEN 1 AND 8),
  CONSTRAINT clinical_progression_progress_range CHECK (progress_pct >= 0 AND progress_pct <= 100)
);

CREATE UNIQUE INDEX clinical_progression_state_unique
  ON public.clinical_progression_state (profile_id, exercise_slug);

CREATE INDEX clinical_progression_state_user_idx
  ON public.clinical_progression_state (user_id);

ALTER TABLE public.clinical_progression_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own progression via profile"
ON public.clinical_progression_state
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = clinical_progression_state.profile_id
    AND profiles.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = clinical_progression_state.profile_id
    AND profiles.user_id = auth.uid()
));

CREATE POLICY "Admins view all progression state"
ON public.clinical_progression_state
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clinicians view assigned progression state"
ON public.clinical_progression_state
FOR SELECT
TO authenticated
USING (is_assigned_clinician(auth.uid(), profile_id));
