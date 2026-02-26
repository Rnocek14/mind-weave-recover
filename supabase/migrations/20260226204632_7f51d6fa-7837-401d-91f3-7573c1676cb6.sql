
-- Cognitive Domain Scores table
CREATE TABLE public.cognitive_domain_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id),
  domain_slug text NOT NULL,
  score numeric NOT NULL,
  score_components jsonb NOT NULL DEFAULT '{}'::jsonb,
  trial_count integer NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'low',
  fatigue_sensitivity numeric,
  transfer_index numeric,
  transfer_components jsonb,
  granularity text NOT NULL DEFAULT 'week',
  domain_version integer NOT NULL DEFAULT 1,
  window_start date NOT NULL,
  window_end date NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index with COALESCE for nullable profile_id
CREATE UNIQUE INDEX idx_cognitive_domain_scores_upsert 
  ON public.cognitive_domain_scores(
    user_id, 
    COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid), 
    domain_slug, 
    window_end, 
    granularity
  );

CREATE INDEX idx_cognitive_domain_scores_user_window 
  ON public.cognitive_domain_scores(user_id, window_end DESC);
CREATE INDEX idx_cognitive_domain_scores_profile_domain 
  ON public.cognitive_domain_scores(profile_id, domain_slug, window_end DESC);

ALTER TABLE public.cognitive_domain_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cognitive scores"
  ON public.cognitive_domain_scores FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all cognitive scores"
  ON public.cognitive_domain_scores FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
