
-- =============================================
-- DEMO DATA SEED: Recovery Story for Presentation
-- Patient: 45 days post-stroke, improving with variability
-- =============================================

-- 1. Set stroke_date to 45 days ago for "Day 45" header badge
UPDATE profiles 
SET stroke_date = (CURRENT_DATE - INTERVAL '45 days')::date,
    profile_name = 'Alex M.'
WHERE id = '5bec007d-744f-41a3-a7ad-a17c14e47b41';

-- 2. Seed daily_readiness for last 14 days (realistic fatigue pattern)
INSERT INTO daily_readiness (user_id, profile_id, checkin_date, fatigue_rating, mood_rating, sleep_quality, notes)
VALUES
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 13, 3, 3, 3, NULL),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 12, 2, 4, 4, NULL),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 11, 2, 4, 3, NULL),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 10, 4, 2, 2, 'Tough night, poor sleep'),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 9, 3, 3, 3, NULL),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 8, 2, 4, 4, NULL),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 7, 2, 4, 4, 'Feeling good today'),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 6, 3, 3, 3, NULL),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 5, 2, 4, 4, NULL),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 4, 4, 2, 2, 'Headache, shortened session'),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 3, 3, 3, 3, NULL),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 2, 2, 4, 4, NULL),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', CURRENT_DATE - 1, 2, 4, 3, NULL)
ON CONFLICT DO NOTHING;

-- 3. Seed dose_logs for last 14 days (4-5 active days/week, realistic minutes)
INSERT INTO dose_logs (user_id, profile_id, domain_slug, dose_value, log_date, source, quality_score, intensity_score)
VALUES
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 18, CURRENT_DATE - 13, 'auto', 3, 2),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 22, CURRENT_DATE - 12, 'auto', 4, 3),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 15, CURRENT_DATE - 11, 'auto', 3, 2),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 25, CURRENT_DATE - 9, 'auto', 4, 3),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 20, CURRENT_DATE - 8, 'auto', 4, 3),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'cognitive', 12, CURRENT_DATE - 8, 'auto', 3, 2),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 19, CURRENT_DATE - 7, 'auto', 4, 3),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 14, CURRENT_DATE - 6, 'auto', 3, 2),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 23, CURRENT_DATE - 5, 'auto', 4, 3),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'cognitive', 10, CURRENT_DATE - 5, 'auto', 3, 2),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 8, CURRENT_DATE - 4, 'auto', 2, 1),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 21, CURRENT_DATE - 3, 'auto', 4, 3),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 24, CURRENT_DATE - 2, 'auto', 4, 3),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'speech', 17, CURRENT_DATE - 1, 'auto', 3, 3),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'cognitive', 8, CURRENT_DATE - 1, 'auto', 3, 2)
ON CONFLICT DO NOTHING;

-- 4. Add meaningful recovery alerts (fatigue spike + accuracy plateau)
INSERT INTO recovery_alerts (user_id, profile_id, alert_type, severity, title, description, trigger_data, domain_slug)
VALUES
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 
   'fatigue_spike', 'warning', 'Elevated fatigue pattern',
   'Fatigue ratings of 4/5 on 2 of the last 5 days. Consider adjusting session length.',
   '{"recent_ratings": [2, 4, 3, 2, 4], "threshold": 3}'::jsonb, 'speech'),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41',
   'accuracy_plateau', 'info', 'Grammar accuracy plateau detected',
   'Sentence construction accuracy has been stable at ~92% for 10 days. May benefit from difficulty adjustment.',
   '{"domain": "grammar", "accuracy": 0.923, "days_stable": 10}'::jsonb, 'speech');

-- 5. Add cognitive domain scores across multiple domains (showing recovery arc)
INSERT INTO cognitive_domain_scores (user_id, profile_id, domain_slug, score, confidence, trial_count, window_start, window_end, score_components, granularity)
VALUES
  -- Word finding - improving
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'word_finding', 0.62, 'high', 85, CURRENT_DATE - 14, CURRENT_DATE - 7, '{"accuracy": 0.58, "speed": 0.65, "consistency": 0.63}'::jsonb, 'week'),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'word_finding', 0.71, 'high', 92, CURRENT_DATE - 7, CURRENT_DATE, '{"accuracy": 0.68, "speed": 0.72, "consistency": 0.73}'::jsonb, 'week'),
  -- Comprehension - strong
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'comprehension', 0.78, 'high', 60, CURRENT_DATE - 14, CURRENT_DATE - 7, '{"accuracy": 0.80, "speed": 0.75, "consistency": 0.79}'::jsonb, 'week'),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'comprehension', 0.82, 'high', 65, CURRENT_DATE - 7, CURRENT_DATE, '{"accuracy": 0.84, "speed": 0.79, "consistency": 0.83}'::jsonb, 'week'),
  -- Sentence building - plateau
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'sentence_building', 0.55, 'medium', 45, CURRENT_DATE - 14, CURRENT_DATE - 7, '{"accuracy": 0.52, "speed": 0.58, "consistency": 0.55}'::jsonb, 'week'),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'sentence_building', 0.57, 'medium', 50, CURRENT_DATE - 7, CURRENT_DATE, '{"accuracy": 0.54, "speed": 0.59, "consistency": 0.58}'::jsonb, 'week'),
  -- Attention - stable good
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'sustained_attention', 0.85, 'high', 110, CURRENT_DATE - 14, CURRENT_DATE - 7, '{"accuracy": 0.88, "speed": 0.82, "consistency": 0.85}'::jsonb, 'week'),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'sustained_attention', 0.86, 'high', 115, CURRENT_DATE - 7, CURRENT_DATE, '{"accuracy": 0.89, "speed": 0.83, "consistency": 0.86}'::jsonb, 'week')
ON CONFLICT DO NOTHING;

-- 6. Update clinical profile with realistic aphasia data
UPDATE profiles 
SET clinical_profile = '{
  "severity": {"overall": "moderate", "speech": "moderate", "comprehension": "mild"},
  "impairments": {
    "motor": ["right_hemiparesis"],
    "speech": ["anomic_aphasia", "word_finding_difficulty"],
    "visual": [],
    "cognitive": ["reduced_attention_span"]
  },
  "affected_side": "right",
  "therapy_focus": ["naming", "sentence_construction", "phonological_awareness"],
  "stroke_location": "left_mca",
  "profile_source": "clinical_note",
  "last_updated": "2026-03-15",
  "notes": "45yo male, L MCA CVA. Anomic aphasia with moderate word-finding difficulty. Good comprehension. Working on functional communication goals."
}'::jsonb
WHERE id = '5bec007d-744f-41a3-a7ad-a17c14e47b41';
