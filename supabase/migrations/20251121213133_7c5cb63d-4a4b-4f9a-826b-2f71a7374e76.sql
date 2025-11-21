-- Add adaptation effectiveness tracking to exercise_events table
ALTER TABLE exercise_events 
ADD COLUMN IF NOT EXISTS adaptations_active jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS error_classification jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS phonological_similarity float DEFAULT NULL,
ADD COLUMN IF NOT EXISTS semantic_similarity float DEFAULT NULL,
ADD COLUMN IF NOT EXISTS classification_confidence float DEFAULT NULL,
ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

-- Create index for querying by adaptations
CREATE INDEX IF NOT EXISTS idx_exercise_events_adaptations 
ON exercise_events USING gin(adaptations_active);

-- Create index for analyzing adaptation effectiveness
CREATE INDEX IF NOT EXISTS idx_exercise_events_session_exercise 
ON exercise_events(session_id, exercise_slug);

COMMENT ON COLUMN exercise_events.adaptations_active IS 'JSON object tracking which adaptations were active during this trial (e.g., {"extended_time": true, "larger_targets": true, "audio_cues": false})';
COMMENT ON COLUMN exercise_events.error_classification IS 'Detailed error classification from ML analysis';
COMMENT ON COLUMN exercise_events.phonological_similarity IS 'Phonological similarity score for error analysis';
COMMENT ON COLUMN exercise_events.semantic_similarity IS 'Semantic similarity score for error analysis';
COMMENT ON COLUMN exercise_events.classification_confidence IS 'Confidence score for error classification';
COMMENT ON COLUMN exercise_events.needs_review IS 'Flag indicating if this trial needs manual review';