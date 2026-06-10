ALTER TABLE public.exercise_events DROP CONSTRAINT IF EXISTS exercise_events_validity_label_chk;

ALTER TABLE public.exercise_events ADD CONSTRAINT exercise_events_validity_label_chk
  CHECK (
    validity_label IS NULL OR validity_label = ANY (ARRAY[
      'valid_attempt'::text,
      'filler_only'::text,
      'no_response'::text,
      'background_noise'::text,
      'other_speaker_suspected'::text,
      'low_confidence'::text,
      'manual_confirmed'::text
    ])
  );