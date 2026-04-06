
-- Voice interaction telemetry persistence
CREATE TABLE public.voice_session_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  topic_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Funnel metrics
  total_turns INTEGER NOT NULL DEFAULT 0,
  voice_turns INTEGER NOT NULL DEFAULT 0,
  text_turns INTEGER NOT NULL DEFAULT 0,
  voice_adoption_rate NUMERIC(5,4) DEFAULT 0,
  
  -- Recognition quality
  mic_starts INTEGER NOT NULL DEFAULT 0,
  mic_successes INTEGER NOT NULL DEFAULT 0,
  recognition_success_rate NUMERIC(5,4) DEFAULT 0,
  avg_confidence NUMERIC(5,4),
  
  -- Preview behavior
  preview_accepted INTEGER NOT NULL DEFAULT 0,
  preview_edited INTEGER NOT NULL DEFAULT 0,
  preview_retried INTEGER NOT NULL DEFAULT 0,
  first_attempt_accept_rate NUMERIC(5,4) DEFAULT 0,
  
  -- Fallback usage
  fallback_chips_used INTEGER NOT NULL DEFAULT 0,
  fallback_type_used INTEGER NOT NULL DEFAULT 0,
  
  -- TTS usage
  tts_plays INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.voice_session_summaries ENABLE ROW LEVEL SECURITY;

-- Users can view their own
CREATE POLICY "Users can view own voice summaries"
  ON public.voice_session_summaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own
CREATE POLICY "Users can insert own voice summaries"
  ON public.voice_session_summaries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all voice summaries"
  ON public.voice_session_summaries
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for user-level queries
CREATE INDEX idx_voice_summaries_user_id ON public.voice_session_summaries(user_id);
CREATE INDEX idx_voice_summaries_created_at ON public.voice_session_summaries(created_at DESC);
