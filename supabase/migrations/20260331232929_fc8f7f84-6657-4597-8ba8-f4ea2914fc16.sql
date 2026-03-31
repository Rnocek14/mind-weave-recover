INSERT INTO public.exercises (slug, title, category, metadata) VALUES
  ('category-fluency', 'Category Fluency', 'speech', '{}'),
  ('synonym-generator', 'Synonym Generator', 'speech', '{}'),
  ('describe-guess', 'Describe & Guess', 'speech', '{}'),
  ('fix-sentence', 'Fix the Sentence', 'speech', '{}'),
  ('follow-directions', 'Follow Directions', 'comprehension', '{}'),
  ('minimal-pairs', 'Minimal Pairs', 'speech', '{}'),
  ('phonological-awareness', 'Phonological Awareness', 'speech', '{}'),
  ('sentence-construction', 'Sentence Construction', 'speech', '{}'),
  ('sentence-game', 'Sentence Game', 'speech', '{}'),
  ('thought-continuation', 'Thought Continuation', 'speech', '{}'),
  ('thought-organization', 'Thought Organization', 'speech', '{}'),
  ('word-finding', 'Word Finding', 'speech', '{}'),
  ('sequence-builder', 'Sequence Builder', 'cognition', '{}'),
  ('abstract-compare', 'Abstract Compare', 'cognition', '{}'),
  ('meaning-match', 'Meaning Match', 'comprehension', '{}'),
  ('pattern-match', 'Pattern Match', 'attention', '{}'),
  ('left-side-hunt', 'Left-Side Hunt', 'attention', '{}')
ON CONFLICT (slug) DO NOTHING;