-- Create exercise_skips table to track when exercises are skipped during lessons
CREATE TABLE IF NOT EXISTS public.exercise_skips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.profiles(id),
  session_id UUID REFERENCES public.sessions(id),
  exercise_slug TEXT NOT NULL,
  skipped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  skip_reason TEXT,
  from_lesson BOOLEAN DEFAULT true,
  clinical_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exercise_skips ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own skips"
  ON public.exercise_skips
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own skips"
  ON public.exercise_skips
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for analytics queries
CREATE INDEX idx_exercise_skips_user_id ON public.exercise_skips(user_id);
CREATE INDEX idx_exercise_skips_profile_id ON public.exercise_skips(profile_id);
CREATE INDEX idx_exercise_skips_exercise_slug ON public.exercise_skips(exercise_slug);
CREATE INDEX idx_exercise_skips_skipped_at ON public.exercise_skips(skipped_at DESC);

-- Index for clinical profile queries (GIN for JSONB)
CREATE INDEX idx_exercise_skips_clinical_snapshot ON public.exercise_skips USING GIN(clinical_snapshot);

COMMENT ON TABLE public.exercise_skips IS 'Tracks when users skip exercises during lesson flows, including clinical profile data for analytics';
COMMENT ON COLUMN public.exercise_skips.clinical_snapshot IS 'Snapshot of clinical_profile at time of skip for cohort analysis';