INSERT INTO achievements (user_id, profile_id, type, value, awarded_at)
VALUES 
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'first-session', 1, now()),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', '50-reps', 1314, now()),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', '3-day-streak', 3, now())
ON CONFLICT (user_id, type) DO NOTHING;