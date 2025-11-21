-- Create recovery_summaries table for AI-generated patient summaries
CREATE TABLE public.recovery_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  summary_type TEXT NOT NULL CHECK (summary_type IN ('progress', 'education')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Source data snapshot for reproducibility
  data_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- AI-generated content
  ai_summary TEXT NOT NULL,
  key_insights TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  
  -- Metadata
  model_used TEXT,
  generation_duration_ms INTEGER,
  confidence_score NUMERIC(3,2),
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  replaces_summary_id UUID REFERENCES public.recovery_summaries(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX idx_recovery_summaries_user_type 
  ON public.recovery_summaries(user_id, summary_type, generated_at DESC);

-- Enable RLS
ALTER TABLE public.recovery_summaries ENABLE ROW LEVEL SECURITY;

-- Users can view their own summaries
CREATE POLICY "Users can view own summaries"
  ON public.recovery_summaries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own summaries
CREATE POLICY "Users can insert own summaries"
  ON public.recovery_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all summaries
CREATE POLICY "Admins can view all summaries"
  ON public.recovery_summaries
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Add helpful comment
COMMENT ON TABLE public.recovery_summaries IS 'AI-generated recovery progress and stroke education summaries for patients';