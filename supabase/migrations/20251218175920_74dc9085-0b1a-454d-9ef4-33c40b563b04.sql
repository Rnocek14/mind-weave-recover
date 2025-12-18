-- Step 1: Update user_speech_profiles to use actual profile_id from profiles table
UPDATE user_speech_profiles usp
SET profile_id = p.id
FROM profiles p
WHERE usp.user_id = p.user_id
  AND usp.profile_id IS NULL
  AND p.is_active = true;

-- Step 2: Update speech_profile_snapshots similarly  
UPDATE speech_profile_snapshots sps
SET profile_id = p.id
FROM profiles p
WHERE sps.user_id = p.user_id
  AND sps.profile_id IS NULL
  AND p.is_active = true;

-- Step 3: Delete any orphaned rows that couldn't be matched
DELETE FROM user_speech_profiles WHERE profile_id IS NULL;
DELETE FROM speech_profile_snapshots WHERE profile_id IS NULL;

-- Step 4: Make profile_id NOT NULL (no default - must be provided)
ALTER TABLE user_speech_profiles 
ALTER COLUMN profile_id SET NOT NULL;

ALTER TABLE speech_profile_snapshots 
ALTER COLUMN profile_id SET NOT NULL;

-- Step 5: Drop the partial unique indexes
DROP INDEX IF EXISTS user_speech_profiles_user_id_null_profile_key;
DROP INDEX IF EXISTS user_speech_profiles_user_id_profile_id_key;

-- Step 6: Create normal unique constraint
ALTER TABLE user_speech_profiles 
ADD CONSTRAINT user_speech_profiles_user_profile_unique 
UNIQUE (user_id, profile_id);