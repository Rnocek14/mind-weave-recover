-- Fix: Clean up duplicate rows (keep only the most recent per user_id)
DELETE FROM public.user_speech_profiles a
USING public.user_speech_profiles b
WHERE a.user_id = b.user_id
  AND a.last_computed_at < b.last_computed_at;

-- Drop the constraint (which will drop the backing index)
ALTER TABLE public.user_speech_profiles 
DROP CONSTRAINT IF EXISTS user_speech_profiles_user_id_profile_id_key;

-- Drop redundant index
DROP INDEX IF EXISTS idx_user_speech_profiles_user_profile;

-- Unique index that handles NULL profile_id correctly (for single-profile users)
CREATE UNIQUE INDEX user_speech_profiles_user_id_null_profile_key 
ON public.user_speech_profiles (user_id) 
WHERE profile_id IS NULL;

-- Unique index for non-null profile_id (for multi-profile users)
CREATE UNIQUE INDEX user_speech_profiles_user_id_profile_id_key 
ON public.user_speech_profiles (user_id, profile_id) 
WHERE profile_id IS NOT NULL;