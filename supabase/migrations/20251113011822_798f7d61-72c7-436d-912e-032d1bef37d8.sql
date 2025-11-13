-- Create reusable function for updating timestamps (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create table to track corrections to AI-inferred clinical profiles
CREATE TABLE IF NOT EXISTS public.clinical_profile_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- What was corrected
  field_name TEXT NOT NULL,
  original_value JSONB NOT NULL,
  corrected_value JSONB NOT NULL,
  
  -- Context
  correction_reason TEXT,
  clinical_note_excerpt TEXT,
  profile_id UUID,
  
  -- Metadata
  confidence_before TEXT,
  parser_version TEXT DEFAULT 'v1.0',
  corrector_role TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.clinical_profile_corrections ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own corrections"
  ON public.clinical_profile_corrections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own corrections"
  ON public.clinical_profile_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own corrections"
  ON public.clinical_profile_corrections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all corrections"
  ON public.clinical_profile_corrections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_corrections_field ON public.clinical_profile_corrections(field_name);
CREATE INDEX idx_corrections_user ON public.clinical_profile_corrections(user_id);
CREATE INDEX idx_corrections_created ON public.clinical_profile_corrections(created_at DESC);

-- Trigger
CREATE TRIGGER update_corrections_updated_at
  BEFORE UPDATE ON public.clinical_profile_corrections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();