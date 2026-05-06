
-- ============================================================
-- Mastery Layer (shadow mode) — additive only, no engine change
-- ============================================================

-- 1. Reference: skill_nodes -------------------------------------------------
CREATE TABLE public.skill_nodes (
  slug             text PRIMARY KEY,
  domain           text NOT NULL,
  exercise_slugs   text[] NOT NULL DEFAULT '{}',
  difficulty_band  int NOT NULL DEFAULT 1,
  description      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skill_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read skill nodes"
  ON public.skill_nodes FOR SELECT
  USING (true);

CREATE POLICY "Admins manage skill nodes"
  ON public.skill_nodes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. user_skill_mastery (current state) ------------------------------------
CREATE TABLE public.user_skill_mastery (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL,
  profile_id                  uuid NOT NULL,
  skill_slug                  text NOT NULL REFERENCES public.skill_nodes(slug) ON DELETE CASCADE,
  mastery_score               numeric NOT NULL DEFAULT 0,         -- 0..1
  confidence                  text    NOT NULL DEFAULT 'none',    -- none/low/medium/high
  trials_total                int     NOT NULL DEFAULT 0,
  trials_recent               int     NOT NULL DEFAULT 0,
  accuracy_recent             numeric,
  cue_independence            numeric,                            -- 0..1
  support_dependency_trend    text,                               -- improving/stable/worsening
  velocity_per_week           numeric,
  plateau_flag                boolean NOT NULL DEFAULT false,
  fatigue_adjusted_score      numeric,
  last_practiced_at           timestamptz,
  model_version               text NOT NULL DEFAULT 'mastery-v0.1-shadow',
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, skill_slug)
);

CREATE INDEX idx_user_skill_mastery_user ON public.user_skill_mastery(user_id);
CREATE INDEX idx_user_skill_mastery_profile ON public.user_skill_mastery(profile_id);
CREATE INDEX idx_user_skill_mastery_skill ON public.user_skill_mastery(skill_slug);

ALTER TABLE public.user_skill_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own mastery via profile"
  ON public.user_skill_mastery FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_skill_mastery.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Users insert own mastery via profile"
  ON public.user_skill_mastery FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_skill_mastery.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Users update own mastery via profile"
  ON public.user_skill_mastery FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_skill_mastery.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Clinicians read assigned mastery"
  ON public.user_skill_mastery FOR SELECT
  USING (is_assigned_clinician(auth.uid(), profile_id));

CREATE POLICY "Admins read all mastery"
  ON public.user_skill_mastery FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. skill_mastery_history (weekly snapshots) ------------------------------
CREATE TABLE public.skill_mastery_history (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL,
  profile_id               uuid NOT NULL,
  skill_slug               text NOT NULL REFERENCES public.skill_nodes(slug) ON DELETE CASCADE,
  week_start               date NOT NULL,
  mastery_score            numeric NOT NULL,
  confidence               text NOT NULL,
  trials_in_week           int NOT NULL DEFAULT 0,
  cue_independence         numeric,
  velocity_per_week        numeric,
  plateau_flag             boolean NOT NULL DEFAULT false,
  fatigue_adjusted_score   numeric,
  model_version            text NOT NULL DEFAULT 'mastery-v0.1-shadow',
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, skill_slug, week_start)
);

CREATE INDEX idx_skill_mastery_history_profile ON public.skill_mastery_history(profile_id, week_start DESC);
CREATE INDEX idx_skill_mastery_history_skill ON public.skill_mastery_history(skill_slug);

ALTER TABLE public.skill_mastery_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own mastery history via profile"
  ON public.skill_mastery_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = skill_mastery_history.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Users insert own mastery history via profile"
  ON public.skill_mastery_history FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = skill_mastery_history.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Clinicians read assigned mastery history"
  ON public.skill_mastery_history FOR SELECT
  USING (is_assigned_clinician(auth.uid(), profile_id));

CREATE POLICY "Admins read all mastery history"
  ON public.skill_mastery_history FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Append-only: no UPDATE/DELETE for non-service roles (no policies = denied)

-- 4. recovery_trajectory (per-user rollup) ---------------------------------
CREATE TABLE public.recovery_trajectory (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  profile_id            uuid NOT NULL,
  domain_scores         jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {naming:0.62, discourse:0.41,...}
  overall_mastery       numeric,
  velocity_30d          numeric,
  plateau_domains       text[] NOT NULL DEFAULT '{}',
  breakthrough_domains  text[] NOT NULL DEFAULT '{}',
  model_version         text NOT NULL DEFAULT 'mastery-v0.1-shadow',
  computed_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id)
);

CREATE INDEX idx_recovery_trajectory_user ON public.recovery_trajectory(user_id);

ALTER TABLE public.recovery_trajectory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own trajectory via profile"
  ON public.recovery_trajectory FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = recovery_trajectory.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Users upsert own trajectory via profile"
  ON public.recovery_trajectory FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = recovery_trajectory.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Users update own trajectory via profile"
  ON public.recovery_trajectory FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = recovery_trajectory.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Clinicians read assigned trajectory"
  ON public.recovery_trajectory FOR SELECT
  USING (is_assigned_clinician(auth.uid(), profile_id));

CREATE POLICY "Admins read all trajectory"
  ON public.recovery_trajectory FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. updated_at trigger for user_skill_mastery -----------------------------
CREATE TRIGGER trg_user_skill_mastery_updated_at
  BEFORE UPDATE ON public.user_skill_mastery
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Seed skill_nodes ------------------------------------------------------
INSERT INTO public.skill_nodes (slug, domain, exercise_slugs, difficulty_band, description) VALUES
  ('naming.high-frequency',     'naming',        ARRAY['photo-naming','two-clues','semantic-feature','dual-load-naming'], 1, 'Retrieval of common, high-frequency object names'),
  ('naming.low-frequency',      'naming',        ARRAY['photo-naming','two-clues','semantic-feature'],                    3, 'Retrieval of less common object names'),
  ('naming.verbs-actions',      'naming',        ARRAY['photo-naming','describe-guess'],                                  3, 'Action / verb retrieval'),
  ('comprehension.single-word', 'comprehension', ARRAY['meaning-match','minimal-pairs'],                                  1, 'Single-word auditory/visual comprehension'),
  ('comprehension.sentence',    'comprehension', ARRAY['fix-sentence','sentence-construction','thought-continuation'],    2, 'Sentence-level comprehension'),
  ('phonology.voicing',         'phonology',     ARRAY['minimal-pairs','phonological'],                                   2, 'Voicing contrasts in minimal pairs'),
  ('phonology.place',           'phonology',     ARRAY['minimal-pairs','phonological'],                                   2, 'Place-of-articulation contrasts'),
  ('phonology.manner',          'phonology',     ARRAY['minimal-pairs','phonological'],                                   3, 'Manner-of-articulation contrasts'),
  ('discourse.narrative',       'discourse',     ARRAY['narrative-retell','conversation-coach','conversation-partner'],   3, 'Narrative production / cohesion'),
  ('discourse.category-fluency','discourse',     ARRAY['category-fluency'],                                               2, 'Semantic / category fluency'),
  ('discourse.synonyms',        'discourse',     ARRAY['synonym-generator'],                                              2, 'Lexical-semantic flexibility (synonyms)'),
  ('executive.planning',        'executive',     ARRAY['multi-step-plan','detective-mind'],                               3, 'Multi-step planning and sequencing'),
  ('executive.abstract',        'executive',     ARRAY['abstract-compare','pattern-match'],                               4, 'Abstract reasoning / comparison'),
  ('executive.attention',       'executive',     ARRAY['pattern-match','dual-load-naming'],                               2, 'Sustained / divided attention')
ON CONFLICT (slug) DO NOTHING;
