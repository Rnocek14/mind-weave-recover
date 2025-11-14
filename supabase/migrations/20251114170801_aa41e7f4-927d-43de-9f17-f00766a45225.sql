-- Enable real-time for exercise_events table
ALTER TABLE public.exercise_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.exercise_events;

-- Enable real-time for probe_results table (if it exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'probe_results') THEN
    ALTER TABLE public.probe_results REPLICA IDENTITY FULL;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.probe_results;
  END IF;
END $$;