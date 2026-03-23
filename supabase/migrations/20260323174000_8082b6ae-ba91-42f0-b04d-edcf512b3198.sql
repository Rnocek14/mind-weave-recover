-- Atomic RPC for practice assignment
CREATE OR REPLACE FUNCTION public.clinician_assign_practice(
  p_user_id uuid,
  p_profile_id uuid,
  p_clinician_id uuid,
  p_notes text DEFAULT 'Additional home practice exercises assigned.'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cp jsonb;
  v_assignments jsonb;
  v_new_id text;
  v_override_id uuid;
  v_count integer;
BEGIN
  SELECT clinical_profile INTO v_cp FROM profiles WHERE id = p_profile_id;
  v_cp := COALESCE(v_cp, '{}'::jsonb);
  v_assignments := COALESCE(v_cp->'practice_assignments', '[]'::jsonb);
  v_count := jsonb_array_length(v_assignments);
  v_new_id := gen_random_uuid()::text;

  -- 1. Add assignment to profile
  v_assignments := v_assignments || jsonb_build_array(jsonb_build_object(
    'id', v_new_id, 'notes', p_notes, 'assigned_by', p_clinician_id,
    'assigned_at', now()::text, 'status', 'active'
  ));
  UPDATE profiles SET clinical_profile = jsonb_set(v_cp, '{practice_assignments}', v_assignments) WHERE id = p_profile_id;

  -- 2. Override record
  INSERT INTO clinician_overrides (user_id, profile_id, clinician_id, override_type, value_before, value_after, reason, status)
  VALUES (
    p_user_id, p_profile_id, p_clinician_id, 'practice_assignment',
    jsonb_build_object('assignment_count', v_count),
    jsonb_build_object('assignment_count', v_count + 1, 'latest', jsonb_build_object('id', v_new_id)),
    p_notes, 'active'
  )
  RETURNING id INTO v_override_id;

  -- 3. Alert
  INSERT INTO recovery_alerts (user_id, profile_id, alert_type, severity, title, description, trigger_data)
  VALUES (p_user_id, p_profile_id, 'practice_assignment', 'info', 'New Practice Assignment', p_notes,
    jsonb_build_object('created_by', p_clinician_id, 'override_id', v_override_id, 'source', 'clinician_override'));

  -- 4. Audit
  INSERT INTO adaptation_events (user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence, value_before, value_after)
  VALUES (p_user_id, p_profile_id, 'clinician_override', 'assign_practice', 'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'override_id', v_override_id, 'notes', p_notes),
    jsonb_build_object('assignment_count', v_count), jsonb_build_object('assignment_count', v_count + 1));

  RETURN jsonb_build_object('success', true, 'message', 'Practice assignment saved to care plan', 'override_id', v_override_id);
END;
$$;

-- Atomic RPC for cueing review
CREATE OR REPLACE FUNCTION public.clinician_review_cueing(
  p_user_id uuid,
  p_profile_id uuid,
  p_clinician_id uuid,
  p_new_cue_level integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cp jsonb;
  v_old_cue jsonb;
  v_override_id uuid;
  v_msg text;
BEGIN
  SELECT clinical_profile INTO v_cp FROM profiles WHERE id = p_profile_id;
  v_cp := COALESCE(v_cp, '{}'::jsonb);
  v_old_cue := COALESCE(v_cp->'cue_level_override', 'null'::jsonb);

  -- 1. Update profile
  v_cp := v_cp || jsonb_build_object(
    'cue_level_override', CASE WHEN p_new_cue_level IS NOT NULL THEN to_jsonb(p_new_cue_level) ELSE 'null'::jsonb END,
    'cue_review_at', now()::text,
    'cue_reviewed_by', p_clinician_id::text
  );
  UPDATE profiles SET clinical_profile = v_cp WHERE id = p_profile_id;

  -- 2. Override record
  INSERT INTO clinician_overrides (user_id, profile_id, clinician_id, override_type, value_before, value_after, reason, status)
  VALUES (
    p_user_id, p_profile_id, p_clinician_id, 'cue_level',
    jsonb_build_object('cue_level', v_old_cue),
    jsonb_build_object('cue_level', COALESCE(to_jsonb(p_new_cue_level), '"reviewed"'::jsonb), 'reviewed_at', now()::text),
    'Clinician reviewed cueing strategy', 'active'
  )
  RETURNING id INTO v_override_id;

  -- 3. Supersede prior cue overrides
  UPDATE clinician_overrides SET status = 'superseded'
  WHERE profile_id = p_profile_id AND override_type = 'cue_level' AND status = 'active' AND id != v_override_id;

  -- 4. Audit
  INSERT INTO adaptation_events (user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence, value_before, value_after)
  VALUES (p_user_id, p_profile_id, 'clinician_override', 'review_cueing', 'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'override_id', v_override_id),
    jsonb_build_object('cue_level', v_old_cue),
    jsonb_build_object('cue_level', COALESCE(to_jsonb(p_new_cue_level), '"reviewed"'::jsonb)));

  v_msg := CASE WHEN p_new_cue_level IS NOT NULL THEN 'Cue level override set to ' || p_new_cue_level ELSE 'Cueing strategy reviewed and logged' END;
  RETURN jsonb_build_object('success', true, 'message', v_msg, 'override_id', v_override_id);
END;
$$;

-- Atomic RPC for scheduling outreach
CREATE OR REPLACE FUNCTION public.clinician_schedule_outreach(
  p_user_id uuid,
  p_profile_id uuid,
  p_clinician_id uuid,
  p_reason text DEFAULT 'Clinician flagged patient for follow-up outreach.'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_override_id uuid;
BEGIN
  -- 1. Alert
  INSERT INTO recovery_alerts (user_id, profile_id, alert_type, severity, title, description, trigger_data)
  VALUES (p_user_id, p_profile_id, 'outreach_needed', 'warning', 'Outreach Scheduled', p_reason,
    jsonb_build_object('created_by', p_clinician_id, 'source', 'clinician_quick_action'));

  -- 2. Override record
  INSERT INTO clinician_overrides (user_id, profile_id, clinician_id, override_type, value_before, value_after, reason, status)
  VALUES (p_user_id, p_profile_id, p_clinician_id, 'outreach', '{}'::jsonb, jsonb_build_object('reason', p_reason), p_reason, 'active')
  RETURNING id INTO v_override_id;

  -- 3. Audit
  INSERT INTO adaptation_events (user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence)
  VALUES (p_user_id, p_profile_id, 'clinician_override', 'schedule_outreach', 'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'override_id', v_override_id, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'message', 'Outreach alert created for care team', 'override_id', v_override_id);
END;
$$;

-- Add runtime_config column to profiles (separate from clinical_profile)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS runtime_config jsonb DEFAULT '{}'::jsonb;