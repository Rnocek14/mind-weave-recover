-- Add profile_id to coach_conversation_summaries to scope clinical aggregates per profile
ALTER TABLE public.coach_conversation_summaries
  ADD COLUMN IF NOT EXISTS profile_id uuid;

-- Backfill from sessions
UPDATE public.coach_conversation_summaries c
SET profile_id = s.profile_id
FROM public.sessions s
WHERE c.session_id = s.id
  AND c.profile_id IS NULL
  AND s.profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coach_conv_summaries_profile_id
  ON public.coach_conversation_summaries(profile_id);

CREATE INDEX IF NOT EXISTS idx_coach_conv_summaries_user_profile_created
  ON public.coach_conversation_summaries(user_id, profile_id, created_at DESC);