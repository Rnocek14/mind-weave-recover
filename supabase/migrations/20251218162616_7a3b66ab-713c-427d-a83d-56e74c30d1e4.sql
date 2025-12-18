-- Create speech_profile_snapshots table for phoneme trend tracking
CREATE TABLE public.speech_profile_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_count_at_computation INTEGER NOT NULL,
  phoneme_difficulty_map JSONB,
  error_type_distribution JSONB,
  cue_efficacy_by_type JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_speech_profile_snapshots_user_computed 
  ON public.speech_profile_snapshots(user_id, computed_at DESC);

CREATE INDEX idx_speech_profile_snapshots_user_trial_count 
  ON public.speech_profile_snapshots(user_id, trial_count_at_computation DESC);

-- Enable RLS
ALTER TABLE public.speech_profile_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own snapshots
CREATE POLICY "Users can view own snapshots"
  ON public.speech_profile_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Admins can view all snapshots  
CREATE POLICY "Admins can view all snapshots"
  ON public.speech_profile_snapshots
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow service role to insert (edge function uses service role)
-- No INSERT policy needed for regular users - only edge function inserts