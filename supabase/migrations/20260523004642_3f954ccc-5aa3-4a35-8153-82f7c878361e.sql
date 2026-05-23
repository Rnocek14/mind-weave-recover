CREATE TABLE public.user_ui_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  variant TEXT NOT NULL DEFAULT 'standard'
    CHECK (variant IN ('standard', 'simplified-fluent', 'simplified-non-fluent', 'simplified-neglect', 'minimal')),
  density TEXT NOT NULL DEFAULT 'comfortable'
    CHECK (density IN ('comfortable', 'spacious')),
  reading_load_cap INTEGER NOT NULL DEFAULT 40 CHECK (reading_load_cap > 0),
  decision_cap INTEGER NOT NULL DEFAULT 4 CHECK (decision_cap > 0),
  auto_selected BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'system'
    CHECK (source IN ('system', 'clinician', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ui_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own UI profile"
ON public.user_ui_profile FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own UI profile"
ON public.user_ui_profile FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(auth.jwt() ->> 'is_anonymous', 'false') = 'false'
);

CREATE POLICY "Users can update own UI profile"
ON public.user_ui_profile FOR UPDATE
USING (
  auth.uid() = user_id
  AND COALESCE(auth.jwt() ->> 'is_anonymous', 'false') = 'false'
);

CREATE POLICY "Assigned clinicians can view patient UI profile"
ON public.user_ui_profile FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_ui_profile.user_id
      AND public.is_assigned_clinician(auth.uid(), p.id)
  )
);

CREATE POLICY "Assigned clinicians can insert patient UI profile"
ON public.user_ui_profile FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_ui_profile.user_id
      AND public.is_assigned_clinician(auth.uid(), p.id)
  )
);

CREATE POLICY "Assigned clinicians can update patient UI profile"
ON public.user_ui_profile FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_ui_profile.user_id
      AND public.is_assigned_clinician(auth.uid(), p.id)
  )
);

CREATE POLICY "Admins can view all UI profiles"
ON public.user_ui_profile FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert any UI profile"
ON public.user_ui_profile FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any UI profile"
ON public.user_ui_profile FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_ui_profile_updated_at
BEFORE UPDATE ON public.user_ui_profile
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();