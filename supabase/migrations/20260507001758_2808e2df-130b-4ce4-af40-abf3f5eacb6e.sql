ALTER TABLE public.adaptation_trial_logs
  ADD COLUMN IF NOT EXISTS trial_mode text,
  ADD COLUMN IF NOT EXISTS graded_score numeric,
  ADD COLUMN IF NOT EXISTS score_vector jsonb,
  ADD COLUMN IF NOT EXISTS signal_granularity text,
  ADD COLUMN IF NOT EXISTS scaffold_level integer,
  ADD COLUMN IF NOT EXISTS dominant_axis text,
  ADD COLUMN IF NOT EXISTS archetype text;

-- Soft validation via trigger (avoids immutability traps of CHECK constraints).
CREATE OR REPLACE FUNCTION public.validate_adaptation_trial_log_granular()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.trial_mode IS NOT NULL
     AND NEW.trial_mode NOT IN ('production','recognition','exposure','scaffolded','mixed') THEN
    RAISE EXCEPTION 'invalid trial_mode: %', NEW.trial_mode;
  END IF;

  IF NEW.signal_granularity IS NOT NULL
     AND NEW.signal_granularity NOT IN ('boolean','graded','multi-dimensional') THEN
    RAISE EXCEPTION 'invalid signal_granularity: %', NEW.signal_granularity;
  END IF;

  IF NEW.dominant_axis IS NOT NULL
     AND NEW.dominant_axis NOT IN (
       'content-complexity','pressure-retention','scaffold-independence',
       'recognition-to-production','mixed'
     ) THEN
    RAISE EXCEPTION 'invalid dominant_axis: %', NEW.dominant_axis;
  END IF;

  IF NEW.archetype IS NOT NULL
     AND NEW.archetype NOT IN ('content-expanding','performance-pressure','hybrid','open-ended') THEN
    RAISE EXCEPTION 'invalid archetype: %', NEW.archetype;
  END IF;

  IF NEW.graded_score IS NOT NULL
     AND (NEW.graded_score < 0 OR NEW.graded_score > 1) THEN
    RAISE EXCEPTION 'graded_score must be in [0,1]: %', NEW.graded_score;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_adaptation_trial_log_granular
  ON public.adaptation_trial_logs;

CREATE TRIGGER trg_validate_adaptation_trial_log_granular
  BEFORE INSERT OR UPDATE ON public.adaptation_trial_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_adaptation_trial_log_granular();

CREATE INDEX IF NOT EXISTS idx_adaptation_trial_logs_trial_mode
  ON public.adaptation_trial_logs (trial_mode)
  WHERE trial_mode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_adaptation_trial_logs_archetype
  ON public.adaptation_trial_logs (archetype)
  WHERE archetype IS NOT NULL;