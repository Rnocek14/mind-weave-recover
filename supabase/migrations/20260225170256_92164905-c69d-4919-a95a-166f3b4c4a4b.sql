-- This historical backfill requires the original auth account and its matching profile.
-- It must not create replacement users, profiles, or clinical data on a fresh install.
DO $backfill$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN auth.users AS u ON u.id = p.user_id
    WHERE p.id = '5bec007d-744f-41a3-a7ad-a17c14e47b41'
      AND u.id = '3a2ae857-680d-4ceb-af7c-095ae3036b2d'
  ) THEN
INSERT INTO achievements (user_id, profile_id, type, value, awarded_at)
VALUES 
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', 'first-session', 1, now()),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', '50-reps', 1314, now()),
  ('3a2ae857-680d-4ceb-af7c-095ae3036b2d', '5bec007d-744f-41a3-a7ad-a17c14e47b41', '3-day-streak', 3, now())
ON CONFLICT (user_id, type) DO NOTHING;
  END IF;
END;
$backfill$;
