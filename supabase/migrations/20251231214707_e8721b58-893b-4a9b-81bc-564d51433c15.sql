-- First, ensure all canonical slugs exist in the exercises table
-- Add missing underscore versions if they don't exist

INSERT INTO exercises (slug, title, category)
SELECT 'sentence_construction', 'Sentence Construction', 'speech'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE slug = 'sentence_construction');

INSERT INTO exercises (slug, title, category)
SELECT 'semantic_features', 'Semantic Features', 'speech'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE slug = 'semantic_features');

-- Now normalize exercise_events to canonical underscore format
UPDATE exercise_events
SET exercise_slug = 'photo_naming'
WHERE exercise_slug = 'photo-naming';

UPDATE exercise_events
SET exercise_slug = 'reach_tap'
WHERE exercise_slug = 'reach-tap';

UPDATE exercise_events
SET exercise_slug = 'phrase_practice'
WHERE exercise_slug = 'word-practice';

UPDATE exercise_events
SET exercise_slug = 'left_side_hunt'
WHERE exercise_slug = 'left-side-hunt';

-- Normalize exercise_skips
UPDATE exercise_skips
SET exercise_slug = 'sentence_construction'
WHERE exercise_slug = 'sentence-construction';

UPDATE exercise_skips
SET exercise_slug = 'semantic_features'
WHERE exercise_slug = 'semantic-features';

UPDATE exercise_skips
SET exercise_slug = 'reach_tap'
WHERE exercise_slug = 'reach-tap';

UPDATE exercise_skips
SET exercise_slug = 'photo_naming'
WHERE exercise_slug = 'photo-naming';

-- Normalize utterance_analyses
UPDATE utterance_analyses
SET exercise_slug = 'photo_naming'
WHERE exercise_slug = 'photo-naming';

UPDATE utterance_analyses
SET exercise_slug = 'phrase_practice'
WHERE exercise_slug = 'word-practice';

UPDATE utterance_analyses
SET exercise_slug = 'reach_tap'
WHERE exercise_slug = 'reach-tap';