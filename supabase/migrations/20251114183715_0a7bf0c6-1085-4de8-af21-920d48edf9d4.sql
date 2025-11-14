-- Add 'attention' to allowed exercise categories
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_category_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_category_check 
  CHECK (category = ANY (ARRAY['motor'::text, 'speech'::text, 'cognition'::text, 'attention'::text]));

-- Now add the new exercises
INSERT INTO exercises (slug, title, category, metadata)
VALUES 
  ('word-practice', 'Phrase Practice', 'speech', '{"description": "Practice functional phrases for daily communication", "type": "speech"}'::jsonb),
  ('left-side-hunt', 'Left-Side Hunt', 'attention', '{"description": "Attention training for left visual field", "type": "motor"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;