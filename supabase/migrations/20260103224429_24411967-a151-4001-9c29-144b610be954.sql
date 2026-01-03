-- =============================================================================
-- Thought Continuation Game: Flow Evaluation Model Support
-- =============================================================================

-- 1. Add evaluation_model column to distinguish game types
ALTER TABLE public.utterance_analyses 
ADD COLUMN IF NOT EXISTS evaluation_model text DEFAULT 'test';

-- 2. Make is_correct nullable for flow games (no correctness concept)
ALTER TABLE public.utterance_analyses 
ALTER COLUMN is_correct DROP NOT NULL;

-- 3. Add flow-specific metrics (all nullable)
ALTER TABLE public.utterance_analyses
ADD COLUMN IF NOT EXISTS did_speak boolean,
ADD COLUMN IF NOT EXISTS utterance_complete boolean,
ADD COLUMN IF NOT EXISTS coherence_score double precision,
ADD COLUMN IF NOT EXISTS momentum_score double precision,
ADD COLUMN IF NOT EXISTS latency_to_first_word_ms integer,
ADD COLUMN IF NOT EXISTS narrowing_level_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS narrowing_trigger text,
ADD COLUMN IF NOT EXISTS momentum_components jsonb,
ADD COLUMN IF NOT EXISTS prompt_intent_type text,
ADD COLUMN IF NOT EXISTS prompt_theme text;

-- 4. Create thought_prompts table for intent-driven prompts
CREATE TABLE IF NOT EXISTS public.thought_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intent_type text NOT NULL,
  theme text NOT NULL,
  prompt_text text NOT NULL,
  narrowing_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  difficulty_tier integer NOT NULL DEFAULT 1,
  time_anchor text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 5. Enable RLS on thought_prompts (read-only for all authenticated users)
ALTER TABLE public.thought_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read thought prompts" 
ON public.thought_prompts 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage thought prompts" 
ON public.thought_prompts 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6. Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_evaluation_model 
ON public.utterance_analyses(evaluation_model);

CREATE INDEX IF NOT EXISTS idx_utterance_analyses_flow_metrics 
ON public.utterance_analyses(user_id, evaluation_model, created_at) 
WHERE evaluation_model = 'flow';

CREATE INDEX IF NOT EXISTS idx_thought_prompts_active 
ON public.thought_prompts(intent_type, theme, difficulty_tier) 
WHERE is_active = true;

-- 7. Add comment for documentation
COMMENT ON COLUMN public.utterance_analyses.evaluation_model IS 'test = traditional right/wrong scoring, flow = momentum-based (no correctness)';
COMMENT ON COLUMN public.utterance_analyses.momentum_components IS 'Explainable momentum: {pauseRatio, prewordPauseAvgMs, filledPauseRate, burstCount, longestPauseMs, trailingOffDetected}';