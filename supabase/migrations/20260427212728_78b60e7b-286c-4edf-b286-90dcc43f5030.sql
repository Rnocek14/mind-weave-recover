-- ============================================================================
-- Phase 2: Adaptive Therapy Intelligence
-- 1) user_adaptation_profiles  — single source of truth per profile
-- 2) v_adaptation_event_summary — clinician-facing live view
-- ============================================================================

CREATE TABLE public.user_adaptation_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL UNIQUE,

  -- Error pattern intelligence
  dominant_error_type text,                       -- semantic | phonemic | no_response | mixed | none
  error_type_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_cue_bias text,                      -- semantic | phonemic | mixed | none

  -- Cue dependency
  cue_dependency_score numeric,                   -- 0..1
  cue_dependency_trend text,                      -- fading | stable | increasing | unknown

  -- Latency
  avg_response_latency_ms integer,
  latency_trend_pct numeric,                      -- + slower, − faster

  -- Engagement baseline
  engagement_baseline jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Longitudinal
  plateau_flag boolean NOT NULL DEFAULT false,
  plateau_domains text[] NOT NULL DEFAULT '{}'::text[],

  -- Bookkeeping
  trial_count_window integer NOT NULL DEFAULT 0,
  data_confidence text NOT NULL DEFAULT 'low',    -- low | medium | high
  version integer NOT NULL DEFAULT 1,
  last_computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uap_user_id ON public.user_adaptation_profiles(user_id);
CREATE INDEX idx_uap_profile_id ON public.user_adaptation_profiles(profile_id);
CREATE INDEX idx_uap_last_computed ON public.user_adaptation_profiles(last_computed_at DESC);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_uap_updated_at
  BEFORE UPDATE ON public.user_adaptation_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_adaptation_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own adaptation profile via profile"
  ON public.user_adaptation_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_adaptation_profiles.profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Clinicians view assigned adaptation profiles"
  ON public.user_adaptation_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_assigned_clinician(auth.uid(), profile_id));

CREATE POLICY "Admins view all adaptation profiles"
  ON public.user_adaptation_profiles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Edge function uses service role; no INSERT/UPDATE policies needed for users.

-- ============================================================================
-- View: v_adaptation_event_summary
-- Per profile × exercise × day rollup of adaptation events for clinician UI.
-- ============================================================================
CREATE OR REPLACE VIEW public.v_adaptation_event_summary AS
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