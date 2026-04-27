-- Recreate the view with SECURITY INVOKER so RLS of the querying user applies.
DROP VIEW IF EXISTS public.v_adaptation_event_summary;

CREATE VIEW public.v_adaptation_event_summary
WITH (security_invoker = true) AS
SELECT
  ae.profile_id,
  ae.user_id,
  ae.exercise_slug,
  date_trunc('day', ae.created_at)::date AS event_date,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE ae.adaptation_type = 'difficulty_change') AS difficulty_changes,
  COUNT(*) FILTER (WHERE ae.adaptation_type = 'cue_escalation') AS cue_escalations,
  COUNT(*) FILTER (WHERE ae.adaptation_type = 'frustration_stepdown') AS frustration_stepdowns,
  COUNT(DISTINCT ae.session_id) AS sessions_touched,
  MAX(ae.created_at) AS last_event_at
FROM public.adaptation_events ae
WHERE ae.created_at > now() - interval '60 days'
GROUP BY ae.profile_id, ae.user_id, ae.exercise_slug, date_trunc('day', ae.created_at);

GRANT SELECT ON public.v_adaptation_event_summary TO authenticated;