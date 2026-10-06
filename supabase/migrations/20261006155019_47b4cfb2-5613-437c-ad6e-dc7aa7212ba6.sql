DO $$
DECLARE
  pid uuid;
  off interval;
  t record;
  cols text;
BEGIN
  FOREACH pid IN ARRAY ARRAY['8891a8e6-ca6a-4bfb-88c1-deb85d0d150c','b0f7bc41-a39c-4917-abd7-178c63879fa7','a21a1be3-2565-46dd-823f-e494f67d2a80']::uuid[] LOOP
    SELECT date_trunc('day', now() - max(started_at)) - interval '1 day' INTO off FROM public.sessions WHERE profile_id = pid;
    IF off IS NULL OR off <= interval '0' THEN CONTINUE; END IF;
    FOR t IN
      SELECT c.table_name FROM information_schema.columns c
      JOIN information_schema.tables tb ON tb.table_schema=c.table_schema AND tb.table_name=c.table_name AND tb.table_type='BASE TABLE'
      WHERE c.table_schema='public' AND c.column_name='profile_id' AND c.table_name <> 'profiles'
    LOOP
      SELECT string_agg(format('%I = %I + %L::interval', column_name, column_name, off), ', ')
        INTO cols
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t.table_name
        AND data_type IN ('timestamp with time zone','timestamp without time zone');
      IF cols IS NOT NULL THEN
        BEGIN
          EXECUTE format('UPDATE public.%I SET %s WHERE profile_id = %L', t.table_name, cols, pid);
        EXCEPTION WHEN others THEN RAISE NOTICE 'skip % : %', t.table_name, SQLERRM;
        END;
      END IF;
      SELECT string_agg(format('%I = %I + %s', column_name, column_name, extract(day from off)::int), ', ')
        INTO cols
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t.table_name AND data_type='date';
      IF cols IS NOT NULL THEN
        BEGIN
          EXECUTE format('UPDATE public.%I SET %s WHERE profile_id = %L', t.table_name, cols, pid);
        EXCEPTION WHEN others THEN RAISE NOTICE 'skip date % : %', t.table_name, SQLERRM;
        END;
      END IF;
    END LOOP;
    -- exercise events without profile_id, linked by session
    UPDATE public.exercise_events e SET created_at = e.created_at + off
      FROM public.sessions s WHERE s.id = e.session_id AND s.profile_id = pid AND e.profile_id IS NULL;
  END LOOP;
END $$;