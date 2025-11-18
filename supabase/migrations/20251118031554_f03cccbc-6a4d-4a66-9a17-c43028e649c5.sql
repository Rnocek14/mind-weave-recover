-- Create standardized assessments table
CREATE TABLE IF NOT EXISTS public.standardized_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('WAB-R', 'BNT', 'NIHSS', 'ASHA-NOMS')),
  assessment_date DATE NOT NULL,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  assessed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.standardized_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own assessments"
  ON public.standardized_assessments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessments"
  ON public.standardized_assessments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assessments"
  ON public.standardized_assessments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assessments"
  ON public.standardized_assessments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_standardized_assessments_user_id ON public.standardized_assessments(user_id);
CREATE INDEX idx_standardized_assessments_type ON public.standardized_assessments(assessment_type);
CREATE INDEX idx_standardized_assessments_date ON public.standardized_assessments(assessment_date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_standardized_assessments_updated_at
  BEFORE UPDATE ON public.standardized_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.standardized_assessments IS 'Stores standardized clinical assessment scores (WAB-R, BNT, NIHSS, ASHA-NOMS) for research and outcome tracking';
COMMENT ON COLUMN public.standardized_assessments.assessment_type IS 'Type of standardized assessment: WAB-R, BNT, NIHSS, or ASHA-NOMS';
COMMENT ON COLUMN public.standardized_assessments.scores IS 'JSON object containing assessment subscales and total scores';
COMMENT ON COLUMN public.standardized_assessments.assessed_by IS 'User ID of clinician/caregiver who administered the assessment';