
CREATE TABLE IF NOT EXISTS public.probe_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID,
  session_id UUID,
  probe_word TEXT NOT NULL,
  target_difficulty INTEGER NOT NULL DEFAULT 1,
  correct BOOLEAN NOT NULL DEFAULT false,
  error_type TEXT,
  cues_needed INTEGER NOT NULL DEFAULT 0,
  reaction_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_probe_results_user_date ON public.probe_results (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_probe_results_session ON public.probe_results (session_id);
CREATE INDEX IF NOT EXISTS idx_probe_results_profile_date ON public.probe_results (profile_id, created_at DESC);

GRANT SELECT, INSERT ON public.probe_results TO authenticated;
GRANT ALL ON public.probe_results TO service_role;

ALTER TABLE public.probe_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own probe results"
ON public.probe_results FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own probe results"
ON public.probe_results FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all probe results"
ON public.probe_results FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Assigned clinicians view patient probe results"
ON public.probe_results FOR SELECT
TO authenticated
USING (profile_id IS NOT NULL AND public.is_assigned_clinician(auth.uid(), profile_id));

CREATE OR REPLACE VIEW public.probe_analytics
WITH (security_invoker = true) AS
SELECT
  user_id,
  profile_id,
  (created_at AT TIME ZONE 'UTC')::date AS assessment_date,
  COUNT(*)::int AS total_probes,
  COUNT(*) FILTER (WHERE correct)::int AS correct_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE correct) / NULLIF(COUNT(*), 0), 1) AS accuracy_pct,
  ROUND(AVG(cues_needed), 2) AS avg_cues_needed,
  ROUND(AVG(reaction_time_ms)) AS avg_reaction_time_ms,
  ROUND(AVG(target_difficulty), 2) AS avg_difficulty,
  COUNT(*) FILTER (WHERE error_type = 'semantic_paraphasia')::int AS semantic_errors,
  COUNT(*) FILTER (WHERE error_type = 'phonemic_paraphasia')::int AS phonemic_errors,
  COUNT(*) FILTER (WHERE error_type = 'neologism')::int AS neologism_errors,
  COUNT(*) FILTER (WHERE error_type = 'unrelated')::int AS unrelated_errors,
  COUNT(*) FILTER (WHERE error_type = 'no_response')::int AS no_response_count
FROM public.probe_results
GROUP BY user_id, profile_id, (created_at AT TIME ZONE 'UTC')::date;

GRANT SELECT ON public.probe_analytics TO authenticated;
