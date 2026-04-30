
-- ============================================================
-- Clinical Trial Readiness Layer — Phase A
-- ============================================================

-- 1. STUDIES -------------------------------------------------
CREATE TABLE public.studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  inclusion_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  exclusion_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  engine_version_pin text,
  scorer_version_pin text,
  pi_clinician_id uuid,
  target_enrollment integer,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;

-- 2. STUDY ENROLLMENTS --------------------------------------
CREATE TABLE public.study_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'screening'
    CHECK (status IN ('screening','eligible','ineligible','consented','active','withdrawn','completed')),
  enrolled_by uuid,
  enrolled_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (study_id, profile_id)
);
ALTER TABLE public.study_enrollments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_study_enrollments_profile ON public.study_enrollments(profile_id);
CREATE INDEX idx_study_enrollments_user ON public.study_enrollments(user_id);
CREATE INDEX idx_study_enrollments_active
  ON public.study_enrollments(study_id) WHERE status IN ('consented','active');

-- 3. ELIGIBILITY SCREENINGS ---------------------------------
CREATE TABLE public.eligibility_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.study_enrollments(id) ON DELETE CASCADE,
  criterion_kind text NOT NULL CHECK (criterion_kind IN ('inclusion','exclusion')),
  criterion_key text NOT NULL,
  criterion_label text NOT NULL,
  met boolean NOT NULL,
  notes text,
  screened_by uuid NOT NULL,
  screened_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.eligibility_screenings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_eligibility_enrollment ON public.eligibility_screenings(enrollment_id);

-- 4. CONSENT DOCUMENTS (versioned templates) ----------------
CREATE TABLE public.consent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  title text NOT NULL,
  body_md text NOT NULL,
  plain_summary text,
  audio_url text,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_documents ENABLE ROW LEVEL SECURITY;

-- 5. CONSENT RECORDS (signed instances — immutable) ---------
CREATE TABLE public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.study_enrollments(id) ON DELETE RESTRICT,
  consent_document_id uuid NOT NULL REFERENCES public.consent_documents(id),
  consent_version integer NOT NULL,
  signed_name text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text,
  capacity_confirmed_by uuid,
  capacity_confirmed_at timestamptz,
  surrogate_signed_name text,
  surrogate_relationship text,
  document_text_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_consent_records_enrollment ON public.consent_records(enrollment_id);

-- 6. TRIAL RUNTIME CONFIG (frozen engine pin) ---------------
CREATE TABLE public.trial_runtime_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL UNIQUE REFERENCES public.studies(id) ON DELETE CASCADE,
  engine_version text NOT NULL,
  scorer_version text NOT NULL,
  runtime_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  pinned_by uuid
);
ALTER TABLE public.trial_runtime_config ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS (security definer to avoid RLS recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_study_clinician(_clinician_id uuid, _study_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.study_enrollments se
    JOIN public.clinician_assignments ca
      ON ca.profile_id = se.profile_id
     AND ca.clinician_id = _clinician_id
     AND ca.revoked_at IS NULL
    WHERE se.study_id = _study_id
  ) OR EXISTS (
    SELECT 1 FROM public.studies s
    WHERE s.id = _study_id AND s.pi_clinician_id = _clinician_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_active_study_enrollment(_user_id uuid)
RETURNS public.study_enrollments
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.study_enrollments
  WHERE user_id = _user_id
    AND status IN ('consented','active')
  ORDER BY enrolled_at DESC NULLS LAST
  LIMIT 1;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- studies
CREATE POLICY "Admins manage all studies" ON public.studies
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Study clinicians read studies" ON public.studies
  FOR SELECT TO authenticated
  USING (
    pi_clinician_id = auth.uid()
    OR public.is_study_clinician(auth.uid(), id)
  );

CREATE POLICY "Enrolled patients read their study" ON public.studies
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.study_enrollments se
    WHERE se.study_id = studies.id
      AND se.user_id = auth.uid()
  ));

-- study_enrollments (append-only for non-admin)
CREATE POLICY "Admins manage all enrollments" ON public.study_enrollments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Patients read own enrollments" ON public.study_enrollments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Assigned clinicians read enrollments" ON public.study_enrollments
  FOR SELECT TO authenticated
  USING (is_assigned_clinician(auth.uid(), profile_id));

CREATE POLICY "Assigned clinicians create enrollments" ON public.study_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_assigned_clinician(auth.uid(), profile_id)
    AND enrolled_by = auth.uid()
  );

-- eligibility_screenings (append-only)
CREATE POLICY "Admins read screenings" ON public.eligibility_screenings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Patients read own screenings" ON public.eligibility_screenings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.study_enrollments se
    WHERE se.id = eligibility_screenings.enrollment_id
      AND se.user_id = auth.uid()
  ));

CREATE POLICY "Assigned clinicians read screenings" ON public.eligibility_screenings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.study_enrollments se
    WHERE se.id = eligibility_screenings.enrollment_id
      AND is_assigned_clinician(auth.uid(), se.profile_id)
  ));

CREATE POLICY "Assigned clinicians insert screenings" ON public.eligibility_screenings
  FOR INSERT TO authenticated
  WITH CHECK (
    screened_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.study_enrollments se
      WHERE se.id = eligibility_screenings.enrollment_id
        AND is_assigned_clinician(auth.uid(), se.profile_id)
    )
  );

-- consent_documents (read by anyone authenticated; write admin only)
CREATE POLICY "Authenticated read consent documents" ON public.consent_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage consent documents" ON public.consent_documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- consent_records (immutable: insert only by patient or assigned clinician)
CREATE POLICY "Admins read consent records" ON public.consent_records
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Patients read own consent records" ON public.consent_records
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.study_enrollments se
    WHERE se.id = consent_records.enrollment_id
      AND se.user_id = auth.uid()
  ));

CREATE POLICY "Assigned clinicians read consent records" ON public.consent_records
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.study_enrollments se
    WHERE se.id = consent_records.enrollment_id
      AND is_assigned_clinician(auth.uid(), se.profile_id)
  ));

CREATE POLICY "Patients sign own consent" ON public.consent_records
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.study_enrollments se
    WHERE se.id = consent_records.enrollment_id
      AND se.user_id = auth.uid()
  ));

CREATE POLICY "Clinicians witness surrogate consent" ON public.consent_records
  FOR INSERT TO authenticated
  WITH CHECK (
    capacity_confirmed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.study_enrollments se
      WHERE se.id = consent_records.enrollment_id
        AND is_assigned_clinician(auth.uid(), se.profile_id)
    )
  );

-- trial_runtime_config (admin-write; enrolled patients + their clinicians read)
CREATE POLICY "Admins manage runtime config" ON public.trial_runtime_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Enrolled patients read runtime config" ON public.trial_runtime_config
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.study_enrollments se
    WHERE se.study_id = trial_runtime_config.study_id
      AND se.user_id = auth.uid()
  ));

CREATE POLICY "Study clinicians read runtime config" ON public.trial_runtime_config
  FOR SELECT TO authenticated
  USING (public.is_study_clinician(auth.uid(), study_id));

-- ============================================================
-- SEED: initial consent document (placeholder — admins can replace)
-- ============================================================
INSERT INTO public.consent_documents (version, title, body_md, plain_summary)
VALUES (
  1,
  'Aphasia Recovery App — Research Consent (v1)',
  '# Research Consent\n\nThis study is observing how an adaptive aphasia therapy app supports your recovery.\n\n## What you will do\n- Use the app most days for the length of the study.\n- Complete a short check-in each week.\n- Allow your clinician to review your progress.\n\n## What we collect\n- Your practice activity and answers in the app.\n- Audio recordings of your speech responses.\n- Notes from your clinician.\n\n## Your rights\n- You can stop at any time.\n- Stopping does not affect your care.\n- Your data is kept private and only shared with your clinical team and the study team.\n\n## Risks\n- Practice may be tiring.\n- If anything feels wrong, tell your clinician right away.',
  'You agree to use the aphasia app and let your clinical team and study team review your practice while you are in the study. You can stop at any time.'
);
