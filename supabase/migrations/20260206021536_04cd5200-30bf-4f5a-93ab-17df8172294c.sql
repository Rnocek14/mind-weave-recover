-- Add the two_clues exercise to the exercises table with valid category
INSERT INTO public.exercises (slug, title, category, metadata)
VALUES ('two_clues', 'Two Clues', 'speech', '{"duration": "5-8 min", "difficulty": "Easy"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;