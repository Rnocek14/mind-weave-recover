-- SHADOW speaker integrity: biometric enrollment and per-attempt audit.
-- NOT an authentication mechanism and NOT a scoring/progression gate.
-- Tables deliberately have no client policies or grants. All mutations go
-- through the authenticated speaker-integrity Edge function, which checks
-- the owning patient profile and the originating session/attempt.
-- Deploy only to an isolated test backend until vendor/legal review.
--
-- IMPORTANT: Service-role columns contain encrypted voiceprints only.
-- Never store a plaintext voiceprint or full provider segment output here.
CREATE TABLE IF NOT EXISTS public.speaker_integrity_enrollments (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_version text NOT NULL DEFAULT 'speaker-v1',
  consent_at timestamptz NOT NULL DEFAULT now(),
  consent_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'failed', 'revoked')),
  provider_job_id text,
  voiceprint_ciphertext text,
  voiceprint_iv text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT speaker_integrity_enrollment_both_or_neither
    CHECK ((voiceprint_ciphertext IS NULL) = (voiceprint_iv IS NULL))
);
CREATE INDEX IF NOT EXISTS speaker_integrity_enrollments_owner_idx
  ON public.speaker_integrity_enrollments (user_id);

CREATE TABLE IF NOT EXISTS public.speaker_integrity_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL,
  enrollment_updated_at timestamptz NOT NULL,
  provider_job_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','complete','failed')),
  label text CHECK (label IN
    ('patient_candidate','mixed_speakers','unmatched_speaker','uncertain')),
  reason text,
  match_confidence numeric,
  observed_speaker_count integer,
  patient_speech_ms integer,
  other_or_unknown_speech_ms integer,
  manual_review_label text CHECK (manual_review_label IN
    ('patient', 'other', 'mixed', 'uncertain')),
  manually_reviewed_at timestamptz,
  manually_reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, attempt_id)
);
CREATE INDEX IF NOT EXISTS speaker_integrity_checks_owner_created_idx
  ON public.speaker_integrity_checks (user_id, profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS speaker_integrity_checks_status_idx
  ON public.speaker_integrity_checks (status, created_at)
  WHERE status = 'pending';

ALTER TABLE public.speaker_integrity_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaker_integrity_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.speaker_integrity_enrollments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.speaker_integrity_checks FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.speaker_integrity_enrollments IS
  'Private encrypted patient voiceprint, opt-in consent and revocation state. Edge/service role only.';
COMMENT ON TABLE public.speaker_integrity_checks IS
  'Non-clinical shadow identity observations for existing audio attempts; no scoring readers.';
