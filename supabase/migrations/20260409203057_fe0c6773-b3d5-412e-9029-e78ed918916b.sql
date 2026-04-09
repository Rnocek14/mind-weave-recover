
-- =============================================
-- Migration 1: Phenotype extraction columns on profiles
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aphasia_type text,
  ADD COLUMN IF NOT EXISTS stroke_mechanism_tag text,
  ADD COLUMN IF NOT EXISTS laterality text,
  ADD COLUMN IF NOT EXISTS primary_territory text,
  ADD COLUMN IF NOT EXISTS chronicity_tag text;

-- Trigger function to auto-extract phenotype from clinical_profile JSONB
CREATE OR REPLACE FUNCTION public.extract_phenotype_from_clinical_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cp jsonb;
  speech_arr jsonb;
  v_aphasia text;
  v_mechanism text;
  v_laterality text;
  v_territory text;
  v_chronicity text;
  v_stroke_date date;
  v_days_since integer;
BEGIN
  cp := COALESCE(NEW.clinical_profile, '{}'::jsonb);

  -- Extract aphasia type from impairments.speech array
  speech_arr := cp->'impairments'->'speech';
  IF speech_arr IS NOT NULL AND jsonb_typeof(speech_arr) = 'array' THEN
    SELECT val INTO v_aphasia FROM jsonb_array_elements_text(speech_arr) AS val
    WHERE val ILIKE '%aphasia%' OR val ILIKE '%anomic%' OR val ILIKE '%broca%' OR val ILIKE '%wernicke%' OR val ILIKE '%global%' OR val ILIKE '%conduction%'
    LIMIT 1;
    -- Normalize
    IF v_aphasia IS NOT NULL THEN
      v_aphasia := CASE
        WHEN v_aphasia ILIKE '%anomic%' THEN 'anomic'
        WHEN v_aphasia ILIKE '%broca%' THEN 'broca'
        WHEN v_aphasia ILIKE '%wernicke%' THEN 'wernicke'
        WHEN v_aphasia ILIKE '%global%' THEN 'global'
        WHEN v_aphasia ILIKE '%conduction%' THEN 'conduction'
        ELSE v_aphasia
      END;
    END IF;
  END IF;

  -- Extract stroke mechanism
  v_mechanism := cp->>'stroke_mechanism';
  IF v_mechanism IS NOT NULL THEN
    v_mechanism := CASE
      WHEN v_mechanism ILIKE '%cardioembolic%' THEN 'cardioembolic'
      WHEN v_mechanism ILIKE '%lacunar%' THEN 'lacunar'
      WHEN v_mechanism ILIKE '%large_artery%' OR v_mechanism ILIKE '%large artery%' THEN 'large_artery'
      ELSE 'undetermined'
    END;
  END IF;

  -- Extract laterality
  v_laterality := cp->>'affected_side';
  IF v_laterality IS NOT NULL THEN
    v_laterality := lower(trim(v_laterality));
    IF v_laterality NOT IN ('left', 'right', 'bilateral') THEN
      v_laterality := NULL;
    END IF;
  END IF;

  -- Extract primary territory
  v_territory := cp->>'vascular_territory';
  IF v_territory IS NULL THEN
    v_territory := cp->>'stroke_location';
  END IF;
  IF v_territory IS NOT NULL THEN
    v_territory := lower(trim(v_territory));
    v_territory := CASE
      WHEN v_territory ILIKE '%mca%' OR v_territory ILIKE '%middle cerebral%' THEN 'mca'
      WHEN v_territory ILIKE '%pca%' OR v_territory ILIKE '%posterior cerebral%' THEN 'pca'
      WHEN v_territory ILIKE '%aca%' OR v_territory ILIKE '%anterior cerebral%' THEN 'aca'
      WHEN v_territory ILIKE '%basilar%' OR v_territory ILIKE '%vertebrobasilar%' THEN 'vertebrobasilar'
      ELSE v_territory
    END;
  END IF;

  -- Compute chronicity from stroke_date
  v_stroke_date := NEW.stroke_date;
  IF v_stroke_date IS NOT NULL THEN
    v_days_since := CURRENT_DATE - v_stroke_date;
    v_chronicity := CASE
      WHEN v_days_since <= 14 THEN 'acute'
      WHEN v_days_since <= 180 THEN 'subacute'
      ELSE 'chronic'
    END;
  END IF;

  NEW.aphasia_type := v_aphasia;
  NEW.stroke_mechanism_tag := v_mechanism;
  NEW.laterality := v_laterality;
  NEW.primary_territory := v_territory;
  NEW.chronicity_tag := v_chronicity;

  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_extract_phenotype ON public.profiles;
CREATE TRIGGER trg_extract_phenotype
  BEFORE INSERT OR UPDATE OF clinical_profile, stroke_date
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.extract_phenotype_from_clinical_profile();

-- Backfill existing rows
UPDATE public.profiles SET clinical_profile = clinical_profile WHERE clinical_profile IS NOT NULL;

-- =============================================
-- Migration 2: retention_snapshots table
-- =============================================

CREATE TABLE IF NOT EXISTS public.retention_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  word text NOT NULL,
  best_score integer,
  best_cue_level integer,
  last_score integer,
  last_cue_level integer,
  session_count integer DEFAULT 0,
  last_practiced_at timestamptz,
  topic text,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, word, snapshot_date)
);

ALTER TABLE public.retention_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own retention snapshots via profile"
  ON public.retention_snapshots
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = retention_snapshots.profile_id AND profiles.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = retention_snapshots.profile_id AND profiles.user_id = auth.uid()
  ));

CREATE POLICY "Clinicians view assigned retention snapshots"
  ON public.retention_snapshots
  FOR SELECT
  TO authenticated
  USING (is_assigned_clinician(auth.uid(), profile_id));

CREATE POLICY "Admins view all retention snapshots"
  ON public.retention_snapshots
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for cohort queries
CREATE INDEX IF NOT EXISTS idx_retention_snapshots_profile_date ON public.retention_snapshots (profile_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_retention_snapshots_word ON public.retention_snapshots (word, snapshot_date);

-- =============================================
-- Migration 3: functional_checkins table
-- =============================================

CREATE TABLE IF NOT EXISTS public.functional_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  communication_of_needs integer,
  conversational_participation integer,
  independence_level integer,
  caregiver_burden integer,
  notes text,
  rated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.functional_checkins ENABLE ROW LEVEL SECURITY;

-- Validation trigger instead of CHECK constraints
CREATE OR REPLACE FUNCTION public.validate_functional_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.communication_of_needs IS NOT NULL AND (NEW.communication_of_needs < 1 OR NEW.communication_of_needs > 5) THEN
    RAISE EXCEPTION 'communication_of_needs must be between 1 and 5';
  END IF;
  IF NEW.conversational_participation IS NOT NULL AND (NEW.conversational_participation < 1 OR NEW.conversational_participation > 5) THEN
    RAISE EXCEPTION 'conversational_participation must be between 1 and 5';
  END IF;
  IF NEW.independence_level IS NOT NULL AND (NEW.independence_level < 1 OR NEW.independence_level > 5) THEN
    RAISE EXCEPTION 'independence_level must be between 1 and 5';
  END IF;
  IF NEW.caregiver_burden IS NOT NULL AND (NEW.caregiver_burden < 1 OR NEW.caregiver_burden > 5) THEN
    RAISE EXCEPTION 'caregiver_burden must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_functional_checkin
  BEFORE INSERT OR UPDATE
  ON public.functional_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_functional_checkin();

CREATE POLICY "Users manage own functional checkins via profile"
  ON public.functional_checkins
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = functional_checkins.profile_id AND profiles.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = functional_checkins.profile_id AND profiles.user_id = auth.uid()
  ));

CREATE POLICY "Clinicians view assigned functional checkins"
  ON public.functional_checkins
  FOR SELECT
  TO authenticated
  USING (is_assigned_clinician(auth.uid(), profile_id));

CREATE POLICY "Admins view all functional checkins"
  ON public.functional_checkins
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_functional_checkins_profile_date ON public.functional_checkins (profile_id, checkin_date);
