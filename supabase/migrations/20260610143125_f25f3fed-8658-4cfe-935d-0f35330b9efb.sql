
-- 1) Append-only progression audit trail
CREATE TABLE public.progression_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  exercise_slug text NOT NULL,
  session_id uuid,
  prev_level integer,
  next_level integer,
  prev_progress_pct numeric,
  next_progress_pct numeric,
  prev_support_baseline integer,
  next_support_baseline integer,
  leveled_up boolean NOT NULL DEFAULT false,
  evidence_met boolean,
  progress_delta numeric,
  trial_count integer,
  mastery_verdict text,
  source text NOT NULL DEFAULT 'session_flush',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- append-only: grant SELECT + INSERT only (no UPDATE/DELETE) to authenticated
GRANT SELECT, INSERT ON public.progression_events TO authenticated;
GRANT ALL ON public.progression_events TO service_role;

ALTER TABLE public.progression_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own progression events via profile"
ON public.progression_events FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = progression_events.profile_id
    AND profiles.user_id = auth.uid()
));

CREATE POLICY "Users read own progression events via profile"
ON public.progression_events FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = progression_events.profile_id
    AND profiles.user_id = auth.uid()
));

CREATE POLICY "Clinicians view assigned progression events"
ON public.progression_events FOR SELECT
TO authenticated
USING (public.is_assigned_clinician(auth.uid(), profile_id));

CREATE POLICY "Admins view all progression events"
ON public.progression_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_progression_events_profile_slug ON public.progression_events (profile_id, exercise_slug, created_at DESC);
CREATE INDEX idx_progression_events_session ON public.progression_events (session_id);

-- 2) profile_id on adaptation_trial_logs + safe backfill
ALTER TABLE public.adaptation_trial_logs ADD COLUMN IF NOT EXISTS profile_id uuid;

UPDATE public.adaptation_trial_logs atl
SET profile_id = s.profile_id
FROM public.sessions s
WHERE atl.session_id = s.id
  AND atl.profile_id IS NULL
  AND s.profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_adaptation_trial_logs_profile ON public.adaptation_trial_logs (profile_id, exercise_slug, created_at DESC);
