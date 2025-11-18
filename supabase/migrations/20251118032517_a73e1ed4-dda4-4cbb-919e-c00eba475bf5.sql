-- Create outcome predictions table
CREATE TABLE IF NOT EXISTS public.outcome_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prediction_data JSONB NOT NULL,
  clinical_context JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.outcome_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own predictions"
  ON public.outcome_predictions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictions"
  ON public.outcome_predictions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_outcome_predictions_user_id ON public.outcome_predictions(user_id);
CREATE INDEX idx_outcome_predictions_created_at ON public.outcome_predictions(created_at DESC);

-- Comments
COMMENT ON TABLE public.outcome_predictions IS 'Stores ML-generated outcome predictions for functional goals and recovery trajectories';
COMMENT ON COLUMN public.outcome_predictions.prediction_data IS 'AI-generated predictions including goal achievement probabilities and recovery milestones';
COMMENT ON COLUMN public.outcome_predictions.clinical_context IS 'Clinical data and learning rates used to generate the prediction';