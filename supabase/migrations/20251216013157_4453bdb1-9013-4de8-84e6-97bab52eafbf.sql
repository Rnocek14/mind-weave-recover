-- Add unique constraint on utterance_analyses(attempt_id)
ALTER TABLE public.utterance_analyses 
ADD CONSTRAINT utterance_analyses_attempt_id_unique UNIQUE (attempt_id);

-- Add partial unique index on exercise_events(attempt_id) where not null
CREATE UNIQUE INDEX IF NOT EXISTS exercise_events_attempt_id_unique 
ON public.exercise_events (attempt_id) 
WHERE attempt_id IS NOT NULL;

-- Add analytics indexes on utterance_analyses
CREATE INDEX IF NOT EXISTS idx_utterance_analyses_user_created 
ON public.utterance_analyses (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_utterance_analyses_session_trial 
ON public.utterance_analyses (session_id, trial_index);

CREATE INDEX IF NOT EXISTS idx_utterance_analyses_exercise_created 
ON public.utterance_analyses (exercise_slug, created_at);

CREATE INDEX IF NOT EXISTS idx_utterance_analyses_error_type 
ON public.utterance_analyses (error_type);

CREATE INDEX IF NOT EXISTS idx_utterance_analyses_target 
ON public.utterance_analyses (target_word);