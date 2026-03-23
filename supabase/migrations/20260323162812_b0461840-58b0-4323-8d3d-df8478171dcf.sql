
-- Clinician overrides table: tracks real plan changes with reversal capability
CREATE TABLE public.clinician_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clinician_id uuid NOT NULL,
  override_type text NOT NULL,
  target_slug text,
  value_before jsonb DEFAULT '{}'::jsonb,
  value_after jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  status text NOT NULL DEFAULT 'active',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.clinician_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own overrides via profile"
  ON public.clinician_overrides FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = clinician_overrides.profile_id AND profiles.user_id = auth.uid()
  ));

CREATE POLICY "Users insert own overrides"
  ON public.clinician_overrides FOR INSERT
  WITH CHECK (auth.uid() = clinician_id);

CREATE POLICY "Users update own overrides"
  ON public.clinician_overrides FOR UPDATE
  USING (auth.uid() = clinician_id);

CREATE POLICY "Admins manage all overrides"
  ON public.clinician_overrides FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_clinician_overrides_profile_active 
  ON public.clinician_overrides (profile_id, status) 
  WHERE status = 'active';
