ALTER TABLE sessions DROP CONSTRAINT sessions_ended_reason_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_ended_reason_check
  CHECK (ended_reason IS NULL OR ended_reason = ANY (ARRAY[
    'completed','abandoned','skipped','pagehide','visibility_timeout',
    'unmount','manual','timeout_sweep','stale_auto_closed','superseded'
  ]));

WITH rich AS (
  SELECT s.id, s.user_id, s.profile_id, s.started_at
  FROM sessions s
  WHERE s.ended_at IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM exercise_events ee WHERE ee.session_id = s.id)
      OR EXISTS (SELECT 1 FROM utterance_analyses ua WHERE ua.session_id = s.id)
      OR EXISTS (SELECT 1 FROM adaptation_trial_logs atl WHERE atl.session_id = s.id)
    )
),
empty_siblings AS (
  SELECT s.id
  FROM sessions s
  WHERE s.ended_at IS NOT NULL
    AND s.ended_reason IS DISTINCT FROM 'superseded'
    AND NOT EXISTS (SELECT 1 FROM exercise_events ee WHERE ee.session_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM utterance_analyses ua WHERE ua.session_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM adaptation_trial_logs atl WHERE atl.session_id = s.id)
    AND EXISTS (
      SELECT 1 FROM rich r
      WHERE r.user_id = s.user_id
        AND r.profile_id IS NOT DISTINCT FROM s.profile_id
        AND r.id <> s.id
        AND ABS(EXTRACT(EPOCH FROM (r.started_at - s.started_at))) < 2
    )
)
UPDATE sessions
SET ended_reason = 'superseded'
WHERE id IN (SELECT id FROM empty_siblings);