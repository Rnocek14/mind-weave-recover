INSERT INTO exercises (slug, title, category) VALUES
('narrative-retell', 'Narrative Retell', 'comprehension'),
('abstract-compare', 'Abstract Comparison', 'comprehension'),
('multi-step-plan', 'Step-by-Step Planning', 'comprehension'),
('dual-load-naming', 'Dual-Load Naming', 'attention')
ON CONFLICT (slug) DO NOTHING;