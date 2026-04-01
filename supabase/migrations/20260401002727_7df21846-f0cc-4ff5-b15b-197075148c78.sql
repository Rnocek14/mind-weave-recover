-- Register missing underscore-format slugs that are being written by normalizeExerciseSlug
INSERT INTO exercises (slug, title, category) VALUES
  ('describe_guess', 'Describe & Guess', 'speech'),
  ('fix_sentence', 'Fix the Sentence', 'speech'),
  ('explain_why', 'Explain Why', 'comprehension'),
  ('left_side_hunt', 'Left Side Hunt', 'motor'),
  ('minimal_pairs', 'Minimal Pairs', 'speech')
ON CONFLICT (slug) DO NOTHING;