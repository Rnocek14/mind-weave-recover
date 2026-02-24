
-- ============================================================
-- RECOVERY SPINE: Therapy-Agnostic Recovery Intelligence Layer
-- ============================================================

-- 1. Recovery Domains — Registry of discipline modules
CREATE TABLE public.recovery_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,          -- 'speech', 'pt', 'ot', 'cognitive', 'cardiac'
  display_name TEXT NOT NULL,          -- 'Speech Therapy', 'Physical Therapy'
  dose_unit TEXT NOT NULL DEFAULT 'minutes',  -- 'minutes', 'reps', 'steps', 'sessions'
  icon_name TEXT,                      -- lucide icon key for UI
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_domains ENABLE ROW LEVEL SECURITY;

-- Domains are public reference data
CREATE POLICY "Everyone can read recovery domains"
  ON public.recovery_domains FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage recovery domains"
  ON public.recovery_domains FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial domains
INSERT INTO public.recovery_domains (slug, display_name, dose_unit, icon_name, sort_order) VALUES
  ('speech', 'Speech Therapy', 'minutes', 'MessageSquare', 1),
  ('pt', 'Physical Therapy', 'minutes', 'Dumbbell', 2),
  ('ot', 'Occupational Therapy', 'minutes', 'Hand', 3),
  ('cognitive', 'Cognitive Training', 'minutes', 'Brain', 4),
  ('activity', 'Physical Activity', 'minutes', 'Activity', 5);


-- 2. Daily Readiness — Patient self-report (discipline-agnostic)
CREATE TABLE public.daily_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fatigue_rating SMALLINT NOT NULL CHECK (fatigue_rating BETWEEN 1 AND 5),
  fatigue_limited_practice BOOLEAN DEFAULT false,
  sleep_quality SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
  pain_level SMALLINT CHECK (pain_level BETWEEN 1 AND 5),
  mood_rating SMALLINT CHECK (mood_rating BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, checkin_date)
);

ALTER TABLE public.daily_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own readiness via profile"
  ON public.daily_readiness FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = daily_readiness.profile_id
      AND profiles.user_id = auth.uid()
  ));

CREATE INDEX idx_daily_readiness_profile_date
  ON public.daily_readiness (profile_id, checkin_date DESC);


-- 3. Dose Targets — Prescribed dose per domain per patient
CREATE TABLE public.dose_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain_slug TEXT NOT NULL REFERENCES public.recovery_domains(slug),
  target_value NUMERIC NOT NULL,           -- e.g. 30 (minutes), 5000 (steps)
  target_frequency TEXT NOT NULL DEFAULT 'daily',  -- 'daily', 'weekly'
  prescribed_by UUID,                      -- clinician who set it
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,                    -- NULL = still active
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, domain_slug, effective_from)
);

ALTER TABLE public.dose_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dose targets via profile"
  ON public.dose_targets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = dose_targets.profile_id
      AND profiles.user_id = auth.uid()
  ));

CREATE INDEX idx_dose_targets_profile_domain
  ON public.dose_targets (profile_id, domain_slug, effective_from DESC);


-- 4. Dose Logs — Actual dose delivered per domain per day
CREATE TABLE public.dose_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain_slug TEXT NOT NULL REFERENCES public.recovery_domains(slug),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'manual',   -- 'manual', 'auto', 'wearable', 'caregiver', 'system'
  dose_value NUMERIC NOT NULL,             -- actual value in domain's dose_unit
  intensity_score SMALLINT CHECK (intensity_score BETWEEN 1 AND 5),  -- optional perceived intensity
  quality_score SMALLINT CHECK (quality_score BETWEEN 1 AND 5),      -- optional session quality
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,      -- extensible (steps breakdown, exercise list, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dose_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dose logs via profile"
  ON public.dose_logs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = dose_logs.profile_id
      AND profiles.user_id = auth.uid()
  ));

CREATE INDEX idx_dose_logs_profile_domain_date
  ON public.dose_logs (profile_id, domain_slug, log_date DESC);

CREATE INDEX idx_dose_logs_profile_date
  ON public.dose_logs (profile_id, log_date DESC);


-- 5. Recovery Alerts — Cross-domain actionable flags
CREATE TABLE public.recovery_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,                -- 'engagement_failure', 'fatigue_risk', 'deterioration', 'dose_inadequacy'
  severity TEXT NOT NULL DEFAULT 'info',   -- 'info', 'warning', 'critical'
  domain_slug TEXT REFERENCES public.recovery_domains(slug),  -- NULL = cross-domain
  title TEXT NOT NULL,
  description TEXT,
  trigger_data JSONB DEFAULT '{}'::jsonb,  -- evidence that caused the flag
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own alerts via profile"
  ON public.recovery_alerts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = recovery_alerts.profile_id
      AND profiles.user_id = auth.uid()
  ));

CREATE POLICY "Users can resolve own alerts"
  ON public.recovery_alerts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = recovery_alerts.profile_id
      AND profiles.user_id = auth.uid()
  ));

CREATE POLICY "Admins manage all alerts"
  ON public.recovery_alerts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_recovery_alerts_profile_unresolved
  ON public.recovery_alerts (profile_id, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX idx_recovery_alerts_severity
  ON public.recovery_alerts (severity, created_at DESC)
  WHERE resolved_at IS NULL;
