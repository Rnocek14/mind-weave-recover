-- Add normalized slug versions (with underscores) as new entries
INSERT INTO exercises (slug, title, category) VALUES 
  ('photo_naming', 'Photo Naming', 'speech'),
  ('reach_tap', 'Reach & Tap', 'motor'),
  ('left_side_hunt', 'Left Side Hunt', 'motor'),
  ('phonological_awareness', 'Phonological Awareness', 'speech'),
  ('semantic_features', 'Semantic Features', 'speech'),
  ('sentence_construction', 'Sentence Construction', 'speech'),
  ('pattern_match', 'Pattern Match', 'motor'),
  ('phrase_practice', 'Phrase Practice', 'speech')
ON CONFLICT (slug) DO NOTHING;