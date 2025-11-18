-- Create functional_goals table for user-defined rehabilitation goals
CREATE TABLE public.functional_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_text TEXT NOT NULL,
  target_domain TEXT NOT NULL, -- 'communication', 'motor', 'cognitive', 'daily_living'
  baseline_status TEXT NOT NULL DEFAULT 'not_yet', -- 'not_yet', 'partial', 'achieved'
  target_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_at TIMESTAMP WITH TIME ZONE,
  created_by UUID -- user_id of person who created (patient or caregiver)
);

-- Create goal_progress_ratings table for weekly check-ins
CREATE TABLE public.goal_progress_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.functional_goals(id) ON DELETE CASCADE,
  rated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL, -- 'not_yet', 'partial', 'achieved'
  notes TEXT,
  rated_by UUID, -- user_id of person who rated
  confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5) -- 1-5 scale
);

-- Enable Row Level Security
ALTER TABLE public.functional_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_progress_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for functional_goals
CREATE POLICY "Users access own goals"
  ON public.functional_goals
  FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for goal_progress_ratings
CREATE POLICY "Users access ratings for own goals"
  ON public.goal_progress_ratings
  FOR ALL
  USING (
    goal_id IN (
      SELECT id FROM public.functional_goals
      WHERE user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_functional_goals_user_id ON public.functional_goals(user_id);
CREATE INDEX idx_functional_goals_archived ON public.functional_goals(user_id, archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_goal_progress_ratings_goal_id ON public.goal_progress_ratings(goal_id);
CREATE INDEX idx_goal_progress_ratings_rated_at ON public.goal_progress_ratings(goal_id, rated_at DESC);