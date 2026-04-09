
-- Activate and populate 3 demo profiles with realistic clinical data
-- Profile 1: "Dad 2" (8891a8e6) -> Margaret T. — Broca's aphasia, left MCA, chronic
UPDATE profiles SET
  profile_name = 'Margaret T.',
  display_name = 'Margaret',
  aphasia_type = 'brocas',
  stroke_date = '2025-08-15',
  laterality = 'left',
  chronicity_tag = 'chronic',
  stroke_mechanism_tag = 'ischemic',
  primary_territory = 'left_mca',
  is_active = true,
  clinical_profile = jsonb_build_object(
    'aphasia_type', 'brocas',
    'severity', 'moderate',
    'primary_deficit', 'expressive',
    'lesion_side', 'left',
    'stroke_type', 'ischemic'
  )
WHERE id = '8891a8e6-ca6a-4bfb-88c1-deb85d0d150c';

-- Profile 2: "Dad 3" (b0f7bc41) -> Robert K. — Anomic aphasia, left MCA, subacute
UPDATE profiles SET
  profile_name = 'Robert K.',
  display_name = 'Robert',
  aphasia_type = 'anomic',
  stroke_date = '2026-01-20',
  laterality = 'left',
  chronicity_tag = 'subacute',
  stroke_mechanism_tag = 'hemorrhagic',
  primary_territory = 'left_mca',
  is_active = true,
  clinical_profile = jsonb_build_object(
    'aphasia_type', 'anomic',
    'severity', 'mild',
    'primary_deficit', 'word_retrieval',
    'lesion_side', 'left',
    'stroke_type', 'hemorrhagic'
  )
WHERE id = 'b0f7bc41-a39c-4917-abd7-178c63879fa7';

-- Profile 3: "dad 2" (a21a1be3) -> Susan M. — Wernicke's aphasia, left posterior, chronic
UPDATE profiles SET
  profile_name = 'Susan M.',
  display_name = 'Susan',
  aphasia_type = 'wernickes',
  stroke_date = '2025-06-10',
  laterality = 'left',
  chronicity_tag = 'chronic',
  stroke_mechanism_tag = 'ischemic',
  primary_territory = 'left_posterior',
  is_active = true,
  clinical_profile = jsonb_build_object(
    'aphasia_type', 'wernickes',
    'severity', 'moderate-severe',
    'primary_deficit', 'comprehension',
    'lesion_side', 'left',
    'stroke_type', 'ischemic'
  )
WHERE id = 'a21a1be3-2565-46dd-823f-e494f67d2a80';

-- Add recovery score snapshots for the 3 demo patients (last 4 weeks)
INSERT INTO recovery_score_snapshots (user_id, profile_id, recovery_score, snapshot_date, confidence_level, score_version, session_count, trial_count, accuracy_score, latency_score, consistency_score, cue_independence_score, endurance_score, error_quality_score) VALUES
-- Margaret T. — slow improvement from 32 to 38
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '8891a8e6-ca6a-4bfb-88c1-deb85d0d150c', 32, '2026-03-19', 'medium', '2.0', 8, 45, 0.42, 0.35, 0.55, 0.30, 0.48, 0.40),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '8891a8e6-ca6a-4bfb-88c1-deb85d0d150c', 34, '2026-03-26', 'medium', '2.0', 12, 68, 0.44, 0.36, 0.56, 0.32, 0.50, 0.42),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '8891a8e6-ca6a-4bfb-88c1-deb85d0d150c', 35, '2026-04-02', 'medium', '2.0', 15, 82, 0.45, 0.37, 0.58, 0.33, 0.52, 0.43),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '8891a8e6-ca6a-4bfb-88c1-deb85d0d150c', 38, '2026-04-09', 'high', '2.0', 20, 110, 0.48, 0.38, 0.60, 0.35, 0.55, 0.45),

-- Robert K. — good improvement from 55 to 64
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'b0f7bc41-a39c-4917-abd7-178c63879fa7', 55, '2026-03-19', 'medium', '2.0', 10, 55, 0.62, 0.58, 0.70, 0.55, 0.65, 0.60),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'b0f7bc41-a39c-4917-abd7-178c63879fa7', 58, '2026-03-26', 'high', '2.0', 18, 95, 0.65, 0.60, 0.72, 0.58, 0.68, 0.62),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'b0f7bc41-a39c-4917-abd7-178c63879fa7', 61, '2026-04-02', 'high', '2.0', 25, 130, 0.68, 0.62, 0.74, 0.60, 0.70, 0.65),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'b0f7bc41-a39c-4917-abd7-178c63879fa7', 64, '2026-04-09', 'high', '2.0', 32, 168, 0.72, 0.64, 0.76, 0.63, 0.72, 0.68),

-- Susan M. — plateauing around 25-27
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'a21a1be3-2565-46dd-823f-e494f67d2a80', 25, '2026-03-19', 'medium', '2.0', 6, 30, 0.30, 0.28, 0.40, 0.22, 0.38, 0.32),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'a21a1be3-2565-46dd-823f-e494f67d2a80', 26, '2026-03-26', 'medium', '2.0', 9, 42, 0.31, 0.28, 0.41, 0.23, 0.39, 0.33),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'a21a1be3-2565-46dd-823f-e494f67d2a80', 25, '2026-04-02', 'medium', '2.0', 11, 50, 0.30, 0.27, 0.40, 0.22, 0.38, 0.32),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'a21a1be3-2565-46dd-823f-e494f67d2a80', 27, '2026-04-09', 'medium', '2.0', 14, 62, 0.32, 0.29, 0.42, 0.24, 0.40, 0.34);

-- Add functional goals for each demo patient
INSERT INTO functional_goals (user_id, profile_id, goal_text, target_domain, baseline_status) VALUES
-- Margaret T.
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '8891a8e6-ca6a-4bfb-88c1-deb85d0d150c', 'Order coffee independently at a cafe', 'expressive_language', 'needs_full_support'),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '8891a8e6-ca6a-4bfb-88c1-deb85d0d150c', 'Tell family members about her day in 3+ sentences', 'discourse', 'needs_partial_support'),
-- Robert K.
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'b0f7bc41-a39c-4917-abd7-178c63879fa7', 'Participate in group conversations with minimal word-finding pauses', 'word_retrieval', 'needs_partial_support'),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'b0f7bc41-a39c-4917-abd7-178c63879fa7', 'Make phone calls to schedule appointments', 'functional_communication', 'needs_partial_support'),
-- Susan M.
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'a21a1be3-2565-46dd-823f-e494f67d2a80', 'Follow 2-step verbal instructions from caregiver', 'comprehension', 'needs_full_support'),
('3a2ae857-680d-4ceb-af7c-095ae3036b2d', 'a21a1be3-2565-46dd-823f-e494f67d2a80', 'Identify correct items when given verbal descriptions', 'receptive_language', 'needs_full_support');
