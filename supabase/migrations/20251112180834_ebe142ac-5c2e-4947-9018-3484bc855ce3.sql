-- Seed default exercises
INSERT INTO exercises (slug, title, category, metadata) VALUES
  ('photo-naming', 'Name That Photo', 'speech', '{"duration_min": 5, "difficulty": "easy", "instructions": "Say the name of each photo you see"}'::jsonb),
  ('reach-tap', 'Reach & Tap', 'motor', '{"duration_min": 8, "difficulty": "medium", "instructions": "Tap the highlighted targets as they appear"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Add consent_version to profiles if missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='consent_version') THEN
    ALTER TABLE profiles ADD COLUMN consent_version INTEGER DEFAULT 1;
  END IF;
END $$;