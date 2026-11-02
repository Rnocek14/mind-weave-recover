-- NeuroSpark patient evidence integrity: transaction-only staging acceptance.
-- Requires the immediately preceding migration
--   supabase/migrations/20261102200000_enforce_patient_evidence_links.sql
-- to have been applied inside the SAME explicit transaction, or already
-- applied on a positively isolated backend.
-- NO COMMIT. Uses two existing anonymous synthetic-only staging identities,
-- does not print identifiers or audio and rolls back every synthetic write.
-- If no safe fixtures exist, fail rather than select a production account.
--
-- Tests are database-level simulated JWT/RLS, not live HTTP token verification.
-- A separate isolated authenticated API suite is still mandatory.
DO $setup_neurospark$
DECLARE
  a uuid;
  b uuid;
  a_session uuid;
  a_profile uuid;
  a_event uuid;
  a_speech uuid;
  b_session uuid;
  b_profile uuid;
BEGIN
  SELECT s.user_id,s.id,s.profile_id,e.id,u.id
  INTO a,a_session,a_profile,a_event,a_speech
  FROM public.sessions s
  JOIN public.exercise_events e ON e.session_id=s.id
  JOIN public.utterance_analyses u ON u.session_id=s.id AND u.user_id=s.user_id
  WHERE s.profile_id IS NOT NULL
  ORDER BY s.started_at DESC LIMIT 1;

  SELECT s.user_id,s.id,s.profile_id
  INTO b,b_session,b_profile FROM public.sessions s
  WHERE s.profile_id IS NOT NULL AND s.user_id<>a
  ORDER BY s.started_at DESC LIMIT 1;

  IF a IS NULL OR b IS NULL OR a=b
     OR a_session IS NULL OR a_event IS NULL OR a_speech IS NULL
     OR b_session IS NULL OR a_profile IS NULL OR b_profile IS NULL THEN
    RAISE EXCEPTION 'Required isolated patient-link fixtures not available';
  END IF;
  PERFORM set_config('neurospark.check.a',a::text,true);
  PERFORM set_config('neurospark.check.b',b::text,true);
  PERFORM set_config('neurospark.check.a_session',a_session::text,true);
  PERFORM set_config('neurospark.check.a_profile',a_profile::text,true);
  PERFORM set_config('neurospark.check.a_event',a_event::text,true);
  PERFORM set_config('neurospark.check.a_speech',a_speech::text,true);
  PERFORM set_config('neurospark.check.b_session',b_session::text,true);
  PERFORM set_config('neurospark.check.b_profile',b_profile::text,true);
END;
$setup_neurospark$;

SET LOCAL ROLE authenticated;
DO $authenticated_checks$
DECLARE
  a uuid:=current_setting('neurospark.check.a')::uuid;
  b uuid:=current_setting('neurospark.check.b')::uuid;
  a_session uuid:=current_setting('neurospark.check.a_session')::uuid;
  a_profile uuid:=current_setting('neurospark.check.a_profile')::uuid;
  b_session uuid:=current_setting('neurospark.check.b_session')::uuid;
  b_profile uuid:=current_setting('neurospark.check.b_profile')::uuid;
  new_session uuid;
  error_code text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',a::text,'role','authenticated')::text,true);
  IF auth.uid() IS DISTINCT FROM a THEN
    RAISE EXCEPTION 'Simulated authenticated identity was not applied';
  END IF;

  -- These were all successfully persisted by the baseline schema BEFORE
  -- this migration, which establishes the red-before side of this regression.
  BEGIN
    INSERT INTO public.sessions(user_id,profile_id,plan)
    VALUES(b,a_profile,'{}'::jsonb);
    RAISE EXCEPTION 'FAIL: cross-user session insert accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.exercise_events(session_id,profile_id,round,counts_toward_score)
    VALUES(a_session,b_profile,1,false);
    RAISE EXCEPTION 'FAIL: cross-patient event insert accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.utterance_analyses(
      user_id,session_id,profile_id,attempt_id,target_word,counts_toward_score)
    VALUES(a,b_session,b_profile,gen_random_uuid(),'synthetic-cross-patient',false);
    RAISE EXCEPTION 'FAIL: cross-patient speech insert accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.utterance_analyses(
      user_id,session_id,profile_id,attempt_id,target_word,counts_toward_score)
    VALUES(a,NULL,b_profile,gen_random_uuid(),'synthetic-standalone-cross-patient',false);
    RAISE EXCEPTION 'FAIL: cross-patient standalone analysis accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- Accepted real workflow: normal patient session, event and speech writes,
  -- including existing BEFORE INSERT profile auto-fill. All rolled back.
  INSERT INTO public.sessions(user_id,profile_id,plan)
  VALUES(a,a_profile,'{}'::jsonb)
  RETURNING id INTO new_session;

  INSERT INTO public.exercise_events(session_id,round,counts_toward_score)
  VALUES(new_session,1,false);
  INSERT INTO public.utterance_analyses(
    user_id,session_id,attempt_id,target_word,counts_toward_score)
  VALUES(a,new_session,gen_random_uuid(),'synthetic-valid-speech',false);
  INSERT INTO public.utterance_analyses(
    user_id,session_id,profile_id,attempt_id,target_word,counts_toward_score)
  VALUES(a,NULL,a_profile,gen_random_uuid(),'synthetic-valid-standalone',false);

  IF (SELECT COUNT(*) FROM public.exercise_events e
      WHERE e.session_id=new_session AND e.profile_id=a_profile)<>1 THEN
    RAISE EXCEPTION 'FAIL: event profile auto-fill changed';
  END IF;
  IF (SELECT COUNT(*) FROM public.utterance_analyses u
      WHERE u.session_id=new_session AND u.user_id=a AND u.profile_id=a_profile)<>1 THEN
    RAISE EXCEPTION 'FAIL: speech profile auto-fill changed';
  END IF;
END;
$authenticated_checks$;

-- Test privileged writes separately: even a backend/service role must
-- not silently change the patient identity of existing evidence.
SET LOCAL ROLE service_role;
DO $backend_checks$
DECLARE
  b uuid:=current_setting('neurospark.check.b')::uuid;
  a_session uuid:=current_setting('neurospark.check.a_session')::uuid;
  a_profile uuid:=current_setting('neurospark.check.a_profile')::uuid;
  b_profile uuid:=current_setting('neurospark.check.b_profile')::uuid;
  a_event uuid:=current_setting('neurospark.check.a_event')::uuid;
  a_speech uuid:=current_setting('neurospark.check.a_speech')::uuid;
BEGIN
  BEGIN
    UPDATE public.sessions SET profile_id=b_profile WHERE id=a_session;
    RAISE EXCEPTION 'FAIL: backend reassigned patient session';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    UPDATE public.profiles SET user_id=b WHERE id=a_profile;
    RAISE EXCEPTION 'FAIL: backend reassigned active profile owner';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    UPDATE public.exercise_events SET profile_id=b_profile WHERE id=a_event;
    RAISE EXCEPTION 'FAIL: backend reassigned existing event';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    UPDATE public.utterance_analyses SET user_id=b WHERE id=a_speech;
    RAISE EXCEPTION 'FAIL: backend reassigned existing speech';
  EXCEPTION WHEN check_violation THEN NULL; END;
END;
$backend_checks$;

SELECT 'PASS: 4 rejected patient-crossing inserts, 4 rejected reassignment updates, 4 compatible writes, no persistent changes' AS test_result;
-- This file is executed within the transaction started by the test operator.
-- It must NEVER contain COMMIT. An outer ROLLBACK is mandatory.
