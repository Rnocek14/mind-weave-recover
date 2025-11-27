-- Drop all foreign keys that depend on profiles(user_id)
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_user_id_fkey;
ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_user_id_fkey;
ALTER TABLE public.clinical_notes DROP CONSTRAINT IF EXISTS clinical_notes_user_id_fkey;
ALTER TABLE public.clinical_notes DROP CONSTRAINT IF EXISTS clinical_notes_uploaded_by_fkey;
ALTER TABLE public.clinical_notes DROP CONSTRAINT IF EXISTS clinical_notes_reviewed_by_fkey;
ALTER TABLE public.clinical_profile_versions DROP CONSTRAINT IF EXISTS clinical_profile_versions_user_id_fkey;
ALTER TABLE public.clinical_profile_versions DROP CONSTRAINT IF EXISTS clinical_profile_versions_created_by_fkey;
ALTER TABLE public.clinical_profile_versions DROP CONSTRAINT IF EXISTS clinical_profile_versions_validated_by_fkey;
ALTER TABLE public.profile_merge_conflicts DROP CONSTRAINT IF EXISTS profile_merge_conflicts_user_id_fkey;
ALTER TABLE public.profile_merge_conflicts DROP CONSTRAINT IF EXISTS profile_merge_conflicts_resolved_by_fkey;
ALTER TABLE public.clinical_profile_corrections DROP CONSTRAINT IF EXISTS clinical_profile_corrections_user_id_fkey;
ALTER TABLE public.dismissed_flags DROP CONSTRAINT IF EXISTS dismissed_flags_user_id_fkey;
ALTER TABLE public.functional_goals DROP CONSTRAINT IF EXISTS functional_goals_user_id_fkey;
ALTER TABLE public.learning_rates DROP CONSTRAINT IF EXISTS learning_rates_user_id_fkey;
ALTER TABLE public.outcome_predictions DROP CONSTRAINT IF EXISTS outcome_predictions_user_id_fkey;
ALTER TABLE public.recovery_summaries DROP CONSTRAINT IF EXISTS recovery_summaries_user_id_fkey;
ALTER TABLE public.standardized_assessments DROP CONSTRAINT IF EXISTS standardized_assessments_user_id_fkey;

-- Now drop the unique constraint
ALTER TABLE public.profiles DROP CONSTRAINT profiles_user_id_unique;

-- Recreate foreign keys without unique constraint requirement
-- These will now reference auth.users directly since profiles.user_id is no longer unique
ALTER TABLE public.sessions 
  ADD CONSTRAINT sessions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.photos
  ADD CONSTRAINT photos_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.clinical_notes
  ADD CONSTRAINT clinical_notes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.clinical_notes
  ADD CONSTRAINT clinical_notes_uploaded_by_fkey 
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.clinical_notes
  ADD CONSTRAINT clinical_notes_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.clinical_profile_versions
  ADD CONSTRAINT clinical_profile_versions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.clinical_profile_versions
  ADD CONSTRAINT clinical_profile_versions_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.clinical_profile_versions
  ADD CONSTRAINT clinical_profile_versions_validated_by_fkey 
  FOREIGN KEY (validated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profile_merge_conflicts
  ADD CONSTRAINT profile_merge_conflicts_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profile_merge_conflicts
  ADD CONSTRAINT profile_merge_conflicts_resolved_by_fkey 
  FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.clinical_profile_corrections
  ADD CONSTRAINT clinical_profile_corrections_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.dismissed_flags
  ADD CONSTRAINT dismissed_flags_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.functional_goals
  ADD CONSTRAINT functional_goals_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.learning_rates
  ADD CONSTRAINT learning_rates_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.outcome_predictions
  ADD CONSTRAINT outcome_predictions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.recovery_summaries
  ADD CONSTRAINT recovery_summaries_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.standardized_assessments
  ADD CONSTRAINT standardized_assessments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;