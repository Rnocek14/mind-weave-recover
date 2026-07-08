-- B9: Voice Practice persisted nothing. One cause was that exercise_events has a
-- foreign key exercise_slug -> exercises(slug), and 'voice_practice' was never
-- seeded, so any attempt to record a voice-practice round would be rejected.
-- Seed the row (idempotent) so the wired-up session can persist telemetry.
INSERT INTO exercises (slug, title, category) VALUES
  ('voice_practice', 'Voice Practice', 'speech')
ON CONFLICT (slug) DO NOTHING;
