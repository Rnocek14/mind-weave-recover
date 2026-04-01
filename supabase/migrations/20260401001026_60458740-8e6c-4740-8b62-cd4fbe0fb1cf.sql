-- Register missing underscore-format canonical slugs
INSERT INTO exercises (slug, title, category) VALUES
  ('abstract_compare', 'Abstract Comparison', 'comprehension'),
  ('conversation_coach', 'Smart Coach', 'speech'),
  ('conversation_partner', 'Free Talk', 'speech'),
  ('dual_load_naming', 'Dual-Load Naming', 'attention'),
  ('multi_step_planning', 'Step-by-Step Planning', 'comprehension'),
  ('narrative_retell', 'Narrative Retell', 'comprehension'),
  ('thought_continuation', 'Thought Continuation', 'speech'),
  ('category_fluency', 'Category Fluency', 'speech'),
  ('synonym_generator', 'Synonym Generator', 'speech')
ON CONFLICT (slug) DO NOTHING;