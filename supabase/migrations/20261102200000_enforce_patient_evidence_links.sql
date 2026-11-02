-- NeuroSpark hospital integrity: prohibit cross-patient evidence attribution.
-- This migration is independent from the clinical scoring/progression algorithms.
-- Apply only after explicit isolated-backend tests, code review and a separate
-- production release decision. No rows or historical scores are rewritten.
--
-- Any violation raises SQLSTATE 23514 (check violation). The error deliberately
-- does not include patient IDs or whether a referenced patient exists.
--
-- The trigger is AFTER ROW so the existing BEFORE INSERT
-- trg_set_profile_id hook can supply missing profile_id before validation.
-- DEFERRABLE lets approved maintenance perform an atomic, auditable transfer
-- in one transaction while still enforcing the final state before COMMIT.

CREATE SCHEMA IF NOT EXISTS private;

-- Close the gap between the preflight audit and trigger installation. A live
-- production rollout needs a reviewed low-traffic maintenance window and a
-- bounded lock_timeout: this blocks concurrent therapy writes temporarily,
-- without blocking ordinary SELECT queries.
LOCK TABLE public.profiles, public.sessions, public.exercise_events,
  public.utterance_analyses IN SHARE ROW EXCLUSIVE MODE;

-- Fail closed if historical rows are already inconsistent. Do not silently
-- "repair" a patient's clinical evidence or apply this in a dirty database.
DO $check_existing_patient_links$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.sessions s
    LEFT JOIN public.profiles p ON p.id=s.profile_id
    WHERE s.profile_id IS NOT NULL
      AND (p.id IS NULL OR p.user_id IS DISTINCT FROM s.user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.exercise_events e
    LEFT JOIN public.sessions s ON s.id=e.session_id
    WHERE s.id IS NULL OR e.profile_id IS DISTINCT FROM s.profile_id
  ) OR EXISTS (
    SELECT 1 FROM public.utterance_analyses u
    LEFT JOIN public.profiles p ON p.id=u.profile_id
    LEFT JOIN public.sessions s ON s.id=u.session_id
    WHERE
      (u.profile_id IS NOT NULL AND (p.id IS NULL OR p.user_id IS DISTINCT FROM u.user_id))
      OR (u.session_id IS NOT NULL AND (
        s.id IS NULL
        OR s.user_id IS DISTINCT FROM u.user_id
        OR s.profile_id IS DISTINCT FROM u.profile_id
      ))
  ) THEN
    RAISE EXCEPTION 'Existing clinical evidence contains inconsistent patient links; migration blocked'
      USING ERRCODE='23514';
  END IF;
END;
$check_existing_patient_links$;

CREATE OR REPLACE FUNCTION private.assert_neurospark_patient_evidence_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $integrity$
DECLARE
  linked_user_id uuid;
  linked_profile_id uuid;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' THEN
    RAISE EXCEPTION 'Invalid evidence table' USING ERRCODE='23514';
  END IF;

  IF TG_TABLE_NAME = 'sessions' THEN
    -- Ordinary duration/summary updates do not need a second owner lookup.
    IF TG_OP='UPDATE'
       AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
       AND NEW.profile_id IS NOT DISTINCT FROM OLD.profile_id THEN
      RETURN NEW;
    END IF;

    IF NEW.profile_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id=NEW.profile_id AND p.user_id=NEW.user_id
      FOR SHARE
    ) THEN
      RAISE EXCEPTION 'Clinical evidence patient-link integrity violation'
        USING ERRCODE='23514';
    END IF;

    -- Moving a session to a different owner/profile must not strand its
    -- existing trials or analyses under another patient's identity.
    IF TG_OP='UPDATE' AND (
      EXISTS (
        SELECT 1 FROM public.exercise_events e
        WHERE e.session_id=NEW.id
          AND e.profile_id IS DISTINCT FROM NEW.profile_id
      ) OR EXISTS (
        SELECT 1 FROM public.utterance_analyses u
        WHERE u.session_id=NEW.id AND (
          u.user_id IS DISTINCT FROM NEW.user_id
          OR u.profile_id IS DISTINCT FROM NEW.profile_id
        )
      )
    ) THEN
      RAISE EXCEPTION 'Clinical evidence patient-link integrity violation'
        USING ERRCODE='23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'exercise_events' THEN
    SELECT s.profile_id INTO linked_profile_id
    FROM public.sessions s WHERE s.id=NEW.session_id FOR SHARE;
    IF NOT FOUND OR NEW.profile_id IS DISTINCT FROM linked_profile_id THEN
      RAISE EXCEPTION 'Clinical evidence patient-link integrity violation'
        USING ERRCODE='23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'utterance_analyses' THEN
    -- Standalone speech analysis is supported; if it has a profile, the
    -- user_id must own that profile, even before a session is attached.
    IF NEW.profile_id IS NOT NULL THEN
      SELECT p.user_id INTO linked_user_id
      FROM public.profiles p WHERE p.id=NEW.profile_id FOR SHARE;
      IF NOT FOUND OR linked_user_id IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION 'Clinical evidence patient-link integrity violation'
          USING ERRCODE='23514';
      END IF;
    END IF;

    IF NEW.session_id IS NOT NULL THEN
      SELECT s.user_id,s.profile_id INTO linked_user_id,linked_profile_id
      FROM public.sessions s WHERE s.id=NEW.session_id FOR SHARE;
      IF NOT FOUND
         OR NEW.user_id IS DISTINCT FROM linked_user_id
         OR NEW.profile_id IS DISTINCT FROM linked_profile_id THEN
        RAISE EXCEPTION 'Clinical evidence patient-link integrity violation'
          USING ERRCODE='23514';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'profiles' THEN
    -- Transferring a profile owner's clinical evidence requires a separately
    -- reviewed, consistent transfer. A simple owner UPDATE is not enough.
    IF TG_OP='UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id
       AND (EXISTS (
         SELECT 1 FROM public.sessions s WHERE s.profile_id=NEW.id
       ) OR EXISTS (
         SELECT 1 FROM public.utterance_analyses u WHERE u.profile_id=NEW.id
       )) THEN
      RAISE EXCEPTION 'Clinical evidence patient-link integrity violation'
        USING ERRCODE='23514';
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid evidence table' USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END;
$integrity$;

-- Do not expose the privileged trigger implementation through the Data API.
REVOKE ALL ON FUNCTION private.assert_neurospark_patient_evidence_links()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.assert_neurospark_patient_evidence_links()
  TO service_role;

CREATE CONSTRAINT TRIGGER clinical_patient_link_sessions
AFTER INSERT OR UPDATE ON public.sessions
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION private.assert_neurospark_patient_evidence_links();

CREATE CONSTRAINT TRIGGER clinical_patient_link_events
AFTER INSERT OR UPDATE ON public.exercise_events
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION private.assert_neurospark_patient_evidence_links();

CREATE CONSTRAINT TRIGGER clinical_patient_link_utterances
AFTER INSERT OR UPDATE ON public.utterance_analyses
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION private.assert_neurospark_patient_evidence_links();

CREATE CONSTRAINT TRIGGER clinical_patient_link_profiles
AFTER UPDATE OF user_id ON public.profiles
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION private.assert_neurospark_patient_evidence_links();

-- Post-application acceptance: deny mismatched owner/profile/session writes
-- from real signed-in synthetic accounts, check compatible same-owner writes,
-- and verify no duplicate event persistence or broken worker/trigger paths.
