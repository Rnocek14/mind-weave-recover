-- Add columns for Whisper transcription and acoustic metrics
ALTER TABLE exercise_events
ADD COLUMN whisper_transcript TEXT,
ADD COLUMN whisper_confidence FLOAT,
ADD COLUMN acoustic_metrics JSONB;