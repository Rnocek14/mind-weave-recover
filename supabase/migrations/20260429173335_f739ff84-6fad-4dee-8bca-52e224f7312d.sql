-- 1. Make sure every hyphenated exercise has a canonical underscored sibling
INSERT INTO public.exercises (slug, title, category, metadata)
SELECT REPLACE(slug, '-', '_') AS slug, title, category, metadata
FROM public.exercises
WHERE slug LIKE '%-%'
ON CONFLICT (slug) DO NOTHING;

-- 2. Backfill event tables (FK now satisfied because canonical row exists)
UPDATE public.adaptation_events
SET exercise_slug = REPLACE(LOWER(exercise_slug), '-', '_')
WHERE exercise_slug IS NOT NULL AND exercise_slug LIKE '%-%';

UPDATE public.adaptation_trial_logs
SET exercise_slug = REPLACE(LOWER(exercise_slug), '-', '_')
WHERE exercise_slug IS NOT NULL AND exercise_slug LIKE '%-%';

UPDATE public.exercise_events
SET exercise_slug = REPLACE(LOWER(exercise_slug), '-', '_')
WHERE exercise_slug IS NOT NULL AND exercise_slug LIKE '%-%';

-- 3. Remove the hyphenated duplicates from exercises so we never insert into them again
DELETE FROM public.exercises WHERE slug LIKE '%-%';