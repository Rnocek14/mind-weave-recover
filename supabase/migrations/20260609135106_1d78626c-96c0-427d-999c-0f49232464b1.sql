-- A2: Profile provenance
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_source text,
  ADD COLUMN IF NOT EXISTS field_confidence jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_source_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_profile_source_check
  CHECK (profile_source IS NULL OR profile_source IN ('onboarding','caregiver','document','clinician'));

-- A3: Consent for ad-hoc document upload (decouple from trial enrollment)
ALTER TABLE public.consent_records
  ADD COLUMN IF NOT EXISTS consent_type text NOT NULL DEFAULT 'trial_enrollment';

ALTER TABLE public.consent_records
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.consent_records ALTER COLUMN enrollment_id DROP NOT NULL;

ALTER TABLE public.consent_records DROP CONSTRAINT IF EXISTS consent_records_consent_type_check;
ALTER TABLE public.consent_records
  ADD CONSTRAINT consent_records_consent_type_check
  CHECK (consent_type IN ('trial_enrollment','document_processing'));

-- document_processing consent must carry a user_id; trial consent must carry an enrollment_id
ALTER TABLE public.consent_records DROP CONSTRAINT IF EXISTS consent_records_linkage_check;
ALTER TABLE public.consent_records
  ADD CONSTRAINT consent_records_linkage_check
  CHECK (
    (consent_type = 'trial_enrollment' AND enrollment_id IS NOT NULL)
    OR (consent_type = 'document_processing' AND user_id IS NOT NULL)
  );

-- Let users insert/read their own document-processing consent rows
DROP POLICY IF EXISTS "Users manage own document consent" ON public.consent_records;
CREATE POLICY "Users manage own document consent"
ON public.consent_records
FOR ALL
TO authenticated
USING (consent_type = 'document_processing' AND user_id = auth.uid())
WITH CHECK (consent_type = 'document_processing' AND user_id = auth.uid());

-- A4: Survivor self-start telemetry
CREATE TABLE IF NOT EXISTS public.survivor_self_start_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  profile_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  day_index integer,
  caregiver_present boolean,
  aphasia_type text,
  severity text,
  surface text NOT NULL DEFAULT 'today',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.survivor_self_start_events TO authenticated;
GRANT ALL ON public.survivor_self_start_events TO service_role;

ALTER TABLE public.survivor_self_start_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own self-start events"
ON public.survivor_self_start_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own self-start events"
ON public.survivor_self_start_events
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Assigned clinicians view patient self-start events"
ON public.survivor_self_start_events
FOR SELECT
TO authenticated
USING (public.is_assigned_clinician(auth.uid(), user_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_self_start_user_day
  ON public.survivor_self_start_events (user_id, day_index);