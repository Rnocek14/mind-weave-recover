
-- Phase 1: Additive denormalization of profile_id onto per-trial tables.
-- Safe to run while app is live: column is nullable, trigger fills new rows,
-- backfill catches existing rows. NOT NULL + RLS tightening happen in a
-- follow-up migration after backfill is verified.

-- 1. Add nullable profile_id columns
ALTER TABLE public.exercise_events         ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.utterance_analyses      ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.engagement_interventions ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Backfill from sessions
UPDATE public.exercise_events e
SET profile_id = s.profile_id
FROM public.sessions s
WHERE e.session_id = s.id AND e.profile_id IS NULL AND s.profile_id IS NOT NULL;

UPDATE public.utterance_analyses u
SET profile_id = s.profile_id
FROM public.sessions s
WHERE u.session_id = s.id AND u.profile_id IS NULL AND s.profile_id IS NOT NULL;

UPDATE public.engagement_interventions ei
SET profile_id = s.profile_id
FROM public.sessions s
WHERE ei.session_id = s.id AND ei.profile_id IS NULL AND s.profile_id IS NOT NULL;

-- 3. Indexes for fast profile-scoped queries
CREATE INDEX IF NOT EXISTS idx_exercise_events_profile_created
  ON public.exercise_events (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_profile_created
  ON public.utterance_analyses (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_interventions_profile_created
  ON public.engagement_interventions (profile_id, created_at DESC);

-- 4. Trigger: auto-populate profile_id from sessions on insert if missing
CREATE OR REPLACE FUNCTION public.set_profile_id_from_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.profile_id IS NULL AND NEW.session_id IS NOT NULL THEN
    SELECT s.profile_id INTO NEW.profile_id
    FROM public.sessions s
    WHERE s.id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_profile_id ON public.exercise_events;
CREATE TRIGGER trg_set_profile_id
  BEFORE INSERT ON public.exercise_events
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_id_from_session();

DROP TRIGGER IF EXISTS trg_set_profile_id ON public.utterance_analyses;
CREATE TRIGGER trg_set_profile_id
  BEFORE INSERT ON public.utterance_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_id_from_session();

DROP TRIGGER IF EXISTS trg_set_profile_id ON public.engagement_interventions;
CREATE TRIGGER trg_set_profile_id
  BEFORE INSERT ON public.engagement_interventions
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_id_from_session();
