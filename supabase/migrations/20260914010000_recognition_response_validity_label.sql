-- Recognition (tap) responses get their own validity label.
--
-- A tapped choice has no utterance to gate. Running the speech validity gate
-- on one recorded every tap as `no_response`, so a patient who tapped ten
-- pictures correctly was stored as having scored nothing. The client now
-- labels taps `recognition_response`: a valid response in its own modality,
-- kept out of speech accuracy, counted toward participation.
--
-- The CHECK constraints below must know the label, or Postgres rejects every
-- tap row and a chip-only session persists no trials at all.

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
      'manual_confirmed'::text,
      'recognition_response'::text
    ])
  );

ALTER TABLE public.utterance_analyses DROP CONSTRAINT IF EXISTS utterance_analyses_validity_label_chk;

ALTER TABLE public.utterance_analyses ADD CONSTRAINT utterance_analyses_validity_label_chk
  CHECK (
    validity_label IS NULL OR validity_label = ANY (ARRAY[
      'valid_attempt'::text,
      'filler_only'::text,
      'no_response'::text,
      'background_noise'::text,
      'other_speaker_suspected'::text,
      'low_confidence'::text,
      'manual_confirmed'::text,
      'recognition_response'::text
    ])
  );
