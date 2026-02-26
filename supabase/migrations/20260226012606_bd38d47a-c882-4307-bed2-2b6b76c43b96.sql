-- Add 'comprehension' to the allowed categories
ALTER TABLE public.exercises DROP CONSTRAINT exercises_category_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_category_check CHECK (category = ANY (ARRAY['motor', 'speech', 'cognition', 'attention', 'comprehension']));

-- Insert detective_mind exercise
INSERT INTO public.exercises (slug, title, category, metadata)
VALUES ('detective_mind', 'Detective Mind', 'comprehension', '{"domain": "comprehension", "modality": "mixed"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;