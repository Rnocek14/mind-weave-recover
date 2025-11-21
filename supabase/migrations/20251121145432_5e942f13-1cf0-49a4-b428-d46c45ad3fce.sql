-- Phase 1: Clinical Profile Evolution System - Foundation
-- Create tables for clinical notes storage, profile versioning, and merge conflict management

-- =====================================================
-- TABLE: clinical_notes
-- Store ALL raw clinical documents with full metadata
-- =====================================================
CREATE TABLE IF NOT EXISTS clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Document metadata
  note_type TEXT NOT NULL CHECK (note_type IN ('mri_report', 'ct_scan', 'discharge_summary', 'progress_note', 'neuropsych_eval', 'initial_assessment', 'other')),
  document_date DATE NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID REFERENCES profiles(user_id),
  
  -- Raw content
  raw_text TEXT NOT NULL,
  document_title TEXT,
  source_system TEXT, -- 'epic', 'cerner', 'manual_upload', etc.
  
  -- Document-specific metadata
  scan_details JSONB DEFAULT '{}'::jsonb,
  
  -- Processing status
  parsed_at TIMESTAMPTZ,
  parser_version TEXT,
  parsing_confidence TEXT CHECK (parsing_confidence IN ('high', 'medium', 'low')),
  extracted_profile JSONB DEFAULT '{}'::jsonb,
  
  -- Notes & flags
  notes TEXT,
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES profiles(user_id),
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinical_notes_user_date ON clinical_notes(user_id, document_date DESC);
CREATE INDEX idx_clinical_notes_type ON clinical_notes(user_id, note_type);
CREATE INDEX idx_clinical_notes_uploaded ON clinical_notes(user_id, uploaded_at DESC);

COMMENT ON TABLE clinical_notes IS 'Stores all raw clinical documents (MRI, CT, discharge notes, etc.) with metadata and parsing status';
COMMENT ON COLUMN clinical_notes.note_type IS 'Type of clinical document';
COMMENT ON COLUMN clinical_notes.document_date IS 'Date the clinical document was created (e.g., scan date, assessment date)';
COMMENT ON COLUMN clinical_notes.raw_text IS 'Original unprocessed text of the clinical document';
COMMENT ON COLUMN clinical_notes.extracted_profile IS 'The clinical profile data extracted from this note by the parser';

-- =====================================================
-- TABLE: clinical_profile_versions
-- Track every change to the clinical profile
-- =====================================================
CREATE TABLE IF NOT EXISTS clinical_profile_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Version metadata
  version_number INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Profile data (full snapshot)
  profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Provenance
  source_type TEXT NOT NULL CHECK (source_type IN ('initial_onboarding', 'note_parsing', 'manual_edit', 'merge', 'clinician_override')),
  source_note_id UUID REFERENCES clinical_notes(id),
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Change tracking
  changes_from_previous JSONB DEFAULT '{}'::jsonb,
  change_reason TEXT,
  
  -- Confidence & validation
  overall_confidence TEXT CHECK (overall_confidence IN ('high', 'medium', 'low')),
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'needs_correction')),
  validated_by UUID REFERENCES profiles(user_id),
  validated_at TIMESTAMPTZ,
  
  -- Ensure only one active version per user
  CONSTRAINT unique_active_version UNIQUE (user_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Drop the unique constraint and recreate as partial index (only enforce uniqueness where is_active = true)
ALTER TABLE clinical_profile_versions DROP CONSTRAINT IF EXISTS unique_active_version;
CREATE UNIQUE INDEX idx_profile_versions_active_unique ON clinical_profile_versions(user_id) WHERE is_active = true;

CREATE INDEX idx_profile_versions_user ON clinical_profile_versions(user_id, version_number DESC);
CREATE INDEX idx_profile_versions_source ON clinical_profile_versions(source_note_id) WHERE source_note_id IS NOT NULL;

COMMENT ON TABLE clinical_profile_versions IS 'Version history of clinical profiles - tracks all changes with full audit trail';
COMMENT ON COLUMN clinical_profile_versions.version_number IS 'Sequential version number (1, 2, 3, etc.) for this user';
COMMENT ON COLUMN clinical_profile_versions.is_active IS 'Only one version should be active (current) per user';
COMMENT ON COLUMN clinical_profile_versions.profile_data IS 'Full snapshot of clinical profile at this version';
COMMENT ON COLUMN clinical_profile_versions.source_type IS 'How this version was created';
COMMENT ON COLUMN clinical_profile_versions.changes_from_previous IS 'JSON diff showing what changed from previous version';

-- =====================================================
-- TABLE: profile_merge_conflicts
-- Manage conflicts when new notes conflict with existing profile
-- =====================================================
CREATE TABLE IF NOT EXISTS profile_merge_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- The two profiles being merged
  existing_profile_version_id UUID REFERENCES clinical_profile_versions(id),
  new_note_id UUID REFERENCES clinical_notes(id),
  new_parsed_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Conflicts detected
  conflicts JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Resolution
  resolution_status TEXT NOT NULL DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'auto_merged', 'manually_resolved', 'rejected')),
  resolved_by UUID REFERENCES profiles(user_id),
  resolved_at TIMESTAMPTZ,
  resolution_choice JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merge_conflicts_user ON profile_merge_conflicts(user_id, created_at DESC);
CREATE INDEX idx_merge_conflicts_status ON profile_merge_conflicts(user_id, resolution_status);

COMMENT ON TABLE profile_merge_conflicts IS 'Tracks conflicts when new clinical notes disagree with existing profile';
COMMENT ON COLUMN profile_merge_conflicts.conflicts IS 'Array of detected conflicts with field, existing value, new value';
COMMENT ON COLUMN profile_merge_conflicts.resolution_choice IS 'User decisions for each conflict';

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_merge_conflicts ENABLE ROW LEVEL SECURITY;

-- clinical_notes policies
CREATE POLICY "Users can view their own clinical notes"
  ON clinical_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clinical notes"
  ON clinical_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clinical notes"
  ON clinical_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clinical notes"
  ON clinical_notes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all clinical notes"
  ON clinical_notes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- clinical_profile_versions policies
CREATE POLICY "Users can view their own profile versions"
  ON clinical_profile_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile versions"
  ON clinical_profile_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profile versions"
  ON clinical_profile_versions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- profile_merge_conflicts policies
CREATE POLICY "Users can view their own merge conflicts"
  ON profile_merge_conflicts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own merge conflicts"
  ON profile_merge_conflicts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own merge conflicts"
  ON profile_merge_conflicts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all merge conflicts"
  ON profile_merge_conflicts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- DATABASE FUNCTIONS
-- =====================================================

-- Get active clinical profile for a user
CREATE OR REPLACE FUNCTION get_active_clinical_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(profile_data, '{}'::jsonb)
  FROM clinical_profile_versions
  WHERE user_id = p_user_id AND is_active = true
  ORDER BY version_number DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_active_clinical_profile IS 'Returns the currently active clinical profile for a user';

-- Create a new profile version
CREATE OR REPLACE FUNCTION create_profile_version(
  p_user_id UUID,
  p_profile_data JSONB,
  p_source_type TEXT,
  p_source_note_id UUID DEFAULT NULL,
  p_change_reason TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version_number INTEGER;
  v_new_id UUID;
  v_previous_profile JSONB;
BEGIN
  -- Get previous profile data for diff
  SELECT profile_data INTO v_previous_profile
  FROM clinical_profile_versions
  WHERE user_id = p_user_id AND is_active = true;
  
  -- Deactivate previous version
  UPDATE clinical_profile_versions
  SET is_active = false
  WHERE user_id = p_user_id AND is_active = true;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_version_number
  FROM clinical_profile_versions
  WHERE user_id = p_user_id;
  
  -- Create new version
  INSERT INTO clinical_profile_versions (
    user_id,
    version_number,
    profile_data,
    source_type,
    source_note_id,
    change_reason,
    created_by,
    is_active,
    changes_from_previous
  ) VALUES (
    p_user_id,
    v_version_number,
    p_profile_data,
    p_source_type,
    p_source_note_id,
    p_change_reason,
    COALESCE(p_created_by, auth.uid()),
    true,
    CASE 
      WHEN v_previous_profile IS NOT NULL THEN
        jsonb_build_object(
          'added_fields', p_profile_data - (SELECT array_agg(key) FROM jsonb_object_keys(v_previous_profile) key),
          'removed_fields', v_previous_profile - (SELECT array_agg(key) FROM jsonb_object_keys(p_profile_data) key)
        )
      ELSE '{}'::jsonb
    END
  ) RETURNING id INTO v_new_id;
  
  -- Update active profile in profiles table
  UPDATE profiles
  SET clinical_profile = p_profile_data
  WHERE user_id = p_user_id;
  
  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION create_profile_version IS 'Creates a new clinical profile version, deactivates old version, and updates profiles table';

-- Migrate existing clinical profiles to version 1
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  -- Only migrate profiles that have clinical_profile data and don't already have a version
  FOR profile_record IN 
    SELECT user_id, clinical_profile
    FROM profiles
    WHERE clinical_profile IS NOT NULL 
      AND clinical_profile != '{}'::jsonb
      AND user_id NOT IN (SELECT DISTINCT user_id FROM clinical_profile_versions)
  LOOP
    -- Create version 1 for this profile
    INSERT INTO clinical_profile_versions (
      user_id,
      version_number,
      profile_data,
      source_type,
      is_active,
      created_by,
      change_reason
    ) VALUES (
      profile_record.user_id,
      1,
      profile_record.clinical_profile,
      'initial_onboarding',
      true,
      profile_record.user_id,
      'Migrated from existing clinical_profile data'
    );
  END LOOP;
END $$;