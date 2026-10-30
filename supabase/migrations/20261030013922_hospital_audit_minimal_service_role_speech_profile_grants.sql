-- Hospital readiness: narrowly restore trusted server-side speech recompute
-- privileges on the synthetic-only Supabase staging branch.
-- Verified issue: service_role bypasses RLS but lacked table-level privileges,
-- causing HTTP 403 even on authorized patients' own profile recomputations.
-- No anon/authenticated grants or patient-facing RLS changes.
--
-- Rollback (only if the speech recompute is intentionally disabled):
-- REVOKE SELECT ON public.profiles, public.utterance_analyses,
--   public.user_speech_profiles, public.speech_profile_snapshots FROM service_role;
-- REVOKE INSERT, UPDATE ON public.user_speech_profiles,
--   public.speech_profile_snapshots FROM service_role;
-- IMPORTANT: test rollback in isolation and review other trusted callers first.
GRANT SELECT ON TABLE public.profiles, public.utterance_analyses,
  public.user_speech_profiles, public.speech_profile_snapshots TO service_role;
GRANT INSERT, UPDATE ON TABLE public.user_speech_profiles,
  public.speech_profile_snapshots TO service_role;
