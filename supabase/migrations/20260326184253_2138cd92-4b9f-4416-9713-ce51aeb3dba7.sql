
-- Coach conversation summaries for cross-session Maya memory
CREATE TABLE public.coach_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  primary_domain TEXT,
  top_struggles TEXT[] DEFAULT '{}',
  top_wins TEXT[] DEFAULT '{}',
  exercise_summaries JSONB DEFAULT '[]',
  maya_summary TEXT,
  avg_score NUMERIC(4,3),
  total_popup_exercises INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- RLS
ALTER TABLE public.coach_conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own coach summaries"
  ON public.coach_conversation_summaries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all coach summaries"
  ON public.coach_conversation_summaries
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookup of latest summary
CREATE INDEX idx_coach_summaries_user_latest
  ON public.coach_conversation_summaries (user_id, created_at DESC);
