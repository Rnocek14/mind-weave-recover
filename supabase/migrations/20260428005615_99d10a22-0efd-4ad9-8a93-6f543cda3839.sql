
CREATE TABLE public.adaptation_trial_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID,
  exercise_slug TEXT NOT NULL,
  trial_index INTEGER NOT NULL,
  difficulty INTEGER NOT NULL,
  cue_level INTEGER,
  cue_dependency NUMERIC,
  success_rate NUMERIC,
  correct BOOLEAN,
  reaction_time_ms INTEGER,
  frustration TEXT,
  fatigue TEXT,
  recommended_action TEXT,
  trials_at_level INTEGER,
  difficulty_change_direction TEXT,
  difficulty_change_from INTEGER,
  difficulty_change_to INTEGER,
  difficulty_change_reason TEXT,
  narration TEXT,
  escalation_blocked BOOLEAN NOT NULL DEFAULT false,
  escalation_block_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_atl_user_session ON public.adaptation_trial_logs(user_id, session_id, trial_index);
CREATE INDEX idx_atl_session ON public.adaptation_trial_logs(session_id);
CREATE INDEX idx_atl_created ON public.adaptation_trial_logs(created_at DESC);

ALTER TABLE public.adaptation_trial_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own adaptation trial logs"
  ON public.adaptation_trial_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own adaptation trial logs"
  ON public.adaptation_trial_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all adaptation trial logs"
  ON public.adaptation_trial_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.adaptation_anomalies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID,
  exercise_slug TEXT,
  trial_index INTEGER,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warn',
  detail TEXT,
  evidence JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_aa_user ON public.adaptation_anomalies(user_id, created_at DESC);
CREATE INDEX idx_aa_session ON public.adaptation_anomalies(session_id);
CREATE INDEX idx_aa_type ON public.adaptation_anomalies(anomaly_type);

ALTER TABLE public.adaptation_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own adaptation anomalies"
  ON public.adaptation_anomalies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own adaptation anomalies"
  ON public.adaptation_anomalies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all adaptation anomalies"
  ON public.adaptation_anomalies FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
