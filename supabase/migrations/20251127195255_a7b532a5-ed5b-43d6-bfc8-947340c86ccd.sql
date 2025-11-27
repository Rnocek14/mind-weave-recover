-- Update RLS policies to check profile ownership via profile_id

-- Sessions
DROP POLICY IF EXISTS "Users access own sessions" ON public.sessions;
CREATE POLICY "Users access own sessions via profile" ON public.sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = sessions.profile_id AND profiles.user_id = auth.uid())
);

-- Exercise events (via sessions)
DROP POLICY IF EXISTS "Users access own events" ON public.exercise_events;
CREATE POLICY "Users access own events via profile" ON public.exercise_events FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.sessions 
    JOIN public.profiles ON profiles.id = sessions.profile_id 
    WHERE sessions.id = exercise_events.session_id AND profiles.user_id = auth.uid()
  )
);

-- Achievements
DROP POLICY IF EXISTS "Users access own achievements" ON public.achievements;
CREATE POLICY "Users access own achievements via profile" ON public.achievements FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = achievements.profile_id AND profiles.user_id = auth.uid())
);

-- Photos
DROP POLICY IF EXISTS "Users access own photos" ON public.photos;
CREATE POLICY "Users access own photos via profile" ON public.photos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = photos.profile_id AND profiles.user_id = auth.uid())
);

-- Clinical notes
DROP POLICY IF EXISTS "Users can view their own clinical notes" ON public.clinical_notes;
DROP POLICY IF EXISTS "Users can insert their own clinical notes" ON public.clinical_notes;
DROP POLICY IF EXISTS "Users can update their own clinical notes" ON public.clinical_notes;
DROP POLICY IF EXISTS "Users can delete their own clinical notes" ON public.clinical_notes;
CREATE POLICY "Users manage own clinical notes via profile" ON public.clinical_notes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = clinical_notes.profile_id AND profiles.user_id = auth.uid())
);

-- Functional goals
DROP POLICY IF EXISTS "Users access own goals" ON public.functional_goals;
CREATE POLICY "Users access own goals via profile" ON public.functional_goals FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = functional_goals.profile_id AND profiles.user_id = auth.uid())
);

-- Goal progress ratings
DROP POLICY IF EXISTS "Users access ratings for own goals" ON public.goal_progress_ratings;
CREATE POLICY "Users access ratings via profile" ON public.goal_progress_ratings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.functional_goals
    JOIN public.profiles ON profiles.id = functional_goals.profile_id
    WHERE functional_goals.id = goal_progress_ratings.goal_id AND profiles.user_id = auth.uid()
  )
);

-- Learning rates
DROP POLICY IF EXISTS "Users access own learning rates" ON public.learning_rates;
CREATE POLICY "Users access own learning rates via profile" ON public.learning_rates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = learning_rates.profile_id AND profiles.user_id = auth.uid())
);

-- Standardized assessments
DROP POLICY IF EXISTS "Users can view own assessments" ON public.standardized_assessments;
DROP POLICY IF EXISTS "Users can insert own assessments" ON public.standardized_assessments;
DROP POLICY IF EXISTS "Users can update own assessments" ON public.standardized_assessments;
DROP POLICY IF EXISTS "Users can delete own assessments" ON public.standardized_assessments;
CREATE POLICY "Users manage own assessments via profile" ON public.standardized_assessments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = standardized_assessments.profile_id AND profiles.user_id = auth.uid())
);

-- Capability assessments
DROP POLICY IF EXISTS "Users can view own capability assessments" ON public.capability_assessments;
DROP POLICY IF EXISTS "Users can insert own capability assessments" ON public.capability_assessments;
DROP POLICY IF EXISTS "Users can update own capability assessments" ON public.capability_assessments;
CREATE POLICY "Users manage capability assessments via profile" ON public.capability_assessments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = capability_assessments.profile_id AND profiles.user_id = auth.uid())
);

-- Recovery summaries
DROP POLICY IF EXISTS "Users can view own summaries" ON public.recovery_summaries;
DROP POLICY IF EXISTS "Users can insert own summaries" ON public.recovery_summaries;
CREATE POLICY "Users manage summaries via profile" ON public.recovery_summaries FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = recovery_summaries.profile_id AND profiles.user_id = auth.uid())
);

-- Outcome predictions
DROP POLICY IF EXISTS "Users can view own predictions" ON public.outcome_predictions;
DROP POLICY IF EXISTS "Users can insert own predictions" ON public.outcome_predictions;
CREATE POLICY "Users manage predictions via profile" ON public.outcome_predictions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = outcome_predictions.profile_id AND profiles.user_id = auth.uid())
);

-- Dismissed flags
DROP POLICY IF EXISTS "Users access own dismissed flags" ON public.dismissed_flags;
CREATE POLICY "Users access dismissed flags via profile" ON public.dismissed_flags FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = dismissed_flags.profile_id AND profiles.user_id = auth.uid())
);

-- Clinical profile versions
DROP POLICY IF EXISTS "Users can view their own profile versions" ON public.clinical_profile_versions;
DROP POLICY IF EXISTS "Users can insert their own profile versions" ON public.clinical_profile_versions;
CREATE POLICY "Users manage profile versions via profile" ON public.clinical_profile_versions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = clinical_profile_versions.profile_id AND profiles.user_id = auth.uid())
);

-- Profile merge conflicts
DROP POLICY IF EXISTS "Users can view their own merge conflicts" ON public.profile_merge_conflicts;
DROP POLICY IF EXISTS "Users can insert their own merge conflicts" ON public.profile_merge_conflicts;
DROP POLICY IF EXISTS "Users can update their own merge conflicts" ON public.profile_merge_conflicts;
CREATE POLICY "Users manage merge conflicts via profile" ON public.profile_merge_conflicts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = profile_merge_conflicts.profile_id AND profiles.user_id = auth.uid())
);

-- Clinical profile corrections
DROP POLICY IF EXISTS "Users can view own corrections" ON public.clinical_profile_corrections;
DROP POLICY IF EXISTS "Users can insert own corrections" ON public.clinical_profile_corrections;
DROP POLICY IF EXISTS "Users can update own corrections" ON public.clinical_profile_corrections;
CREATE POLICY "Users manage corrections via profile" ON public.clinical_profile_corrections FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = clinical_profile_corrections.profile_id AND profiles.user_id = auth.uid())
);

-- Helper functions for profile management
CREATE OR REPLACE FUNCTION public.get_active_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.switch_active_profile(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET is_active = false WHERE user_id = auth.uid();
  UPDATE public.profiles SET is_active = true WHERE id = p_profile_id AND user_id = auth.uid();
END;
$$;