-- Migrate old /ax/ keys to /ə/ in user_speech_profiles
UPDATE user_speech_profiles
SET phoneme_difficulty_map =
  (phoneme_difficulty_map - '/ax/')
  || jsonb_build_object('/ə/', phoneme_difficulty_map->'/ax/')
WHERE phoneme_difficulty_map ? '/ax/';

-- Migrate old /ax/ keys to /ə/ in speech_profile_snapshots
UPDATE speech_profile_snapshots
SET phoneme_difficulty_map =
  (phoneme_difficulty_map - '/ax/')
  || jsonb_build_object('/ə/', phoneme_difficulty_map->'/ax/')
WHERE phoneme_difficulty_map ? '/ax/';