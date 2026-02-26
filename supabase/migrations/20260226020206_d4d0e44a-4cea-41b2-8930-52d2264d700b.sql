INSERT INTO public.exercises (slug, title, category, metadata)
VALUES ('meaning_match', 'Meaning Match', 'comprehension', '{"description": "Read a sentence and pick the correct meaning", "version": "1.0"}')
ON CONFLICT (slug) DO NOTHING;