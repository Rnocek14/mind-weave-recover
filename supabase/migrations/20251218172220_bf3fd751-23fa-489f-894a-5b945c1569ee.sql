-- Add phoneme coverage metadata columns to user_speech_profiles
ALTER TABLE public.user_speech_profiles
ADD COLUMN IF NOT EXISTS trials_with_gop_data integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS trials_with_phonemes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS trials_with_nonzero_accuracy integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS phoneme_token_count integer DEFAULT 0;

-- Add phoneme coverage metadata columns to speech_profile_snapshots
ALTER TABLE public.speech_profile_snapshots
ADD COLUMN IF NOT EXISTS trials_with_gop_data integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS trials_with_phonemes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS trials_with_nonzero_accuracy integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS phoneme_token_count integer DEFAULT 0;