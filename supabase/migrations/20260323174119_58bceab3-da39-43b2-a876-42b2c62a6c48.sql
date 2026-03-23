-- Update all RPCs to use runtime_config instead of clinical_profile for runtime state

-- Migrate existing runtime data from clinical_profile to runtime_config
UPDATE profiles
SET runtime_config = jsonb_build_object(
  'difficulty_overrides', COALESCE(clinical_profile->'difficulty_overrides', '{}'::jsonb),
  'cue_level_override', clinical_profile->'cue_level_override',
  'cue_review_at', clinical_profile->'cue_review_at',
  'cue_reviewed_by', clinical_profile->'cue_reviewed_by',
  'practice_assignments', COALESCE(clinical_profile->'practice_assignments', '[]'::jsonb)
)
WHERE clinical_profile IS NOT NULL
  AND (clinical_profile ? 'difficulty_overrides' OR clinical_profile ? 'cue_level_override' OR clinical_profile ? 'practice_assignments');

-- Recreate adjust_difficulty to use runtime_config
CREATE OR REPLACE FUNCTION public.clinician_adjust_difficulty(
  p_user_id uuid,
  p_profile_id uuid,
  p_clinician_id uuid,
  p_direction text DEFAULT 'decrease',
  p_exercise_slug text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rc jsonb;
  v_overrides jsonb;
  v_key text;
  v_current_level integer;
  v_new_level integer;
  v_override_id uuid;
BEGIN
  SELECT runtime_config INTO v_rc FROM profiles WHERE id = p_profile_id;
  v_rc := COALESCE(v_rc, '{}'::jsonb);
  v_overrides := COALESCE(v_rc->'difficulty_overrides', '{}'::jsonb);
  v_key := COALESCE(p_exercise_slug, '_global');
  v_current_level := COALESCE((v_overrides->>v_key)::integer, 0);
  v_new_level := CASE WHEN p_direction = 'increase' THEN v_current_level + 1 ELSE v_current_level - 1 END;

  UPDATE profiles
  SET runtime_config = jsonb_set(COALESCE(runtime_config, '{}'::jsonb), '{difficulty_overrides}', v_overrides || jsonb_build_object(v_key, v_new_level))
  WHERE id = p_profile_id;

  INSERT INTO clinician_overrides (user_id, profile_id, clinician_id, override_type, target_slug, value_before, value_after, reason, status)
  VALUES (p_user_id, p_profile_id, p_clinician_id, 'difficulty', p_exercise_slug,
    jsonb_build_object('difficulty_level', v_current_level, 'target', v_key),
    jsonb_build_object('difficulty_level', v_new_level, 'target', v_key),
    'Clinician ' || p_direction || 'd difficulty via weekly review', 'active')
  RETURNING id INTO v_override_id;

  UPDATE clinician_overrides SET status = 'superseded'
  WHERE profile_id = p_profile_id AND override_type = 'difficulty' AND status = 'active'
    AND id != v_override_id AND (target_slug IS NOT DISTINCT FROM p_exercise_slug);

  INSERT INTO recovery_alerts (user_id, profile_id, alert_type, severity, title, description, trigger_data)
  VALUES (p_user_id, p_profile_id, 'difficulty_adjustment', 'info',
    'Difficulty ' || CASE WHEN p_direction = 'increase' THEN 'Increased' ELSE 'Decreased' END,
    'Clinician ' || p_direction || 'd difficulty' || CASE WHEN p_exercise_slug IS NOT NULL THEN ' for ' || replace(p_exercise_slug, '-', ' ') ELSE ' globally' END || '.',
    jsonb_build_object('created_by', p_clinician_id, 'direction', p_direction, 'override_id', v_override_id, 'source', 'clinician_override'));

  INSERT INTO adaptation_events (user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence, value_before, value_after)
  VALUES (p_user_id, p_profile_id, 'clinician_override', p_direction || '_difficulty', 'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'direction', p_direction, 'exercise_slug', COALESCE(p_exercise_slug, 'all'), 'override_id', v_override_id),
    jsonb_build_object('difficulty_level', v_current_level), jsonb_build_object('difficulty_level', v_new_level));

  RETURN jsonb_build_object('success', true, 'message', 'Difficulty ' || p_direction || 'd (' || v_current_level || ' to ' || v_new_level || ')', 'override_id', v_override_id);
END;
$$;

-- Recreate assign_practice to use runtime_config
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
  v_rc jsonb;
  v_assignments jsonb;
  v_new_id text;
  v_override_id uuid;
  v_count integer;
BEGIN
  SELECT runtime_config INTO v_rc FROM profiles WHERE id = p_profile_id;
  v_rc := COALESCE(v_rc, '{}'::jsonb);
  v_assignments := COALESCE(v_rc->'practice_assignments', '[]'::jsonb);
  v_count := jsonb_array_length(v_assignments);
  v_new_id := gen_random_uuid()::text;

  v_assignments := v_assignments || jsonb_build_array(jsonb_build_object(
    'id', v_new_id, 'notes', p_notes, 'assigned_by', p_clinician_id,
    'assigned_at', now()::text, 'status', 'active'
  ));
  UPDATE profiles SET runtime_config = jsonb_set(COALESCE(runtime_config, '{}'::jsonb), '{practice_assignments}', v_assignments) WHERE id = p_profile_id;

  INSERT INTO clinician_overrides (user_id, profile_id, clinician_id, override_type, value_before, value_after, reason, status)
  VALUES (p_user_id, p_profile_id, p_clinician_id, 'practice_assignment',
    jsonb_build_object('assignment_count', v_count),
    jsonb_build_object('assignment_count', v_count + 1, 'latest', jsonb_build_object('id', v_new_id)),
    p_notes, 'active')
  RETURNING id INTO v_override_id;

  INSERT INTO recovery_alerts (user_id, profile_id, alert_type, severity, title, description, trigger_data)
  VALUES (p_user_id, p_profile_id, 'practice_assignment', 'info', 'New Practice Assignment', p_notes,
    jsonb_build_object('created_by', p_clinician_id, 'override_id', v_override_id, 'source', 'clinician_override'));

  INSERT INTO adaptation_events (user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence, value_before, value_after)
  VALUES (p_user_id, p_profile_id, 'clinician_override', 'assign_practice', 'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'override_id', v_override_id, 'notes', p_notes),
    jsonb_build_object('assignment_count', v_count), jsonb_build_object('assignment_count', v_count + 1));

  RETURN jsonb_build_object('success', true, 'message', 'Practice assignment saved to care plan', 'override_id', v_override_id);
END;
$$;

-- Recreate review_cueing to use runtime_config
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
  v_rc jsonb;
  v_old_cue jsonb;
  v_override_id uuid;
  v_msg text;
BEGIN
  SELECT runtime_config INTO v_rc FROM profiles WHERE id = p_profile_id;
  v_rc := COALESCE(v_rc, '{}'::jsonb);
  v_old_cue := COALESCE(v_rc->'cue_level_override', 'null'::jsonb);

  v_rc := v_rc || jsonb_build_object(
    'cue_level_override', CASE WHEN p_new_cue_level IS NOT NULL THEN to_jsonb(p_new_cue_level) ELSE 'null'::jsonb END,
    'cue_review_at', now()::text,
    'cue_reviewed_by', p_clinician_id::text
  );
  UPDATE profiles SET runtime_config = v_rc WHERE id = p_profile_id;

  INSERT INTO clinician_overrides (user_id, profile_id, clinician_id, override_type, value_before, value_after, reason, status)
  VALUES (p_user_id, p_profile_id, p_clinician_id, 'cue_level',
    jsonb_build_object('cue_level', v_old_cue),
    jsonb_build_object('cue_level', COALESCE(to_jsonb(p_new_cue_level), '"reviewed"'::jsonb), 'reviewed_at', now()::text),
    'Clinician reviewed cueing strategy', 'active')
  RETURNING id INTO v_override_id;

  UPDATE clinician_overrides SET status = 'superseded'
  WHERE profile_id = p_profile_id AND override_type = 'cue_level' AND status = 'active' AND id != v_override_id;

  INSERT INTO adaptation_events (user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence, value_before, value_after)
  VALUES (p_user_id, p_profile_id, 'clinician_override', 'review_cueing', 'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'override_id', v_override_id),
    jsonb_build_object('cue_level', v_old_cue),
    jsonb_build_object('cue_level', COALESCE(to_jsonb(p_new_cue_level), '"reviewed"'::jsonb)));

  v_msg := CASE WHEN p_new_cue_level IS NOT NULL THEN 'Cue level override set to ' || p_new_cue_level ELSE 'Cueing strategy reviewed and logged' END;
  RETURN jsonb_build_object('success', true, 'message', v_msg, 'override_id', v_override_id);
END;
$$;

-- Update reverse_override to use runtime_config for difficulty/cue/practice
CREATE OR REPLACE FUNCTION public.clinician_reverse_override(
  p_user_id uuid,
  p_profile_id uuid,
  p_clinician_id uuid,
  p_override_id uuid,
  p_reason text DEFAULT 'Reversed via weekly review'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_override RECORD;
  v_rc jsonb;
  v_overrides jsonb;
  v_key text;
  v_assignments jsonb;
  v_latest_id text;
BEGIN
  SELECT * INTO v_override FROM clinician_overrides WHERE id = p_override_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Override not found');
  END IF;
  IF v_override.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Override already reversed/superseded');
  END IF;

  UPDATE clinician_overrides
  SET status = 'reversed', reversed_at = now(), reversed_by = p_clinician_id, reversal_reason = p_reason
  WHERE id = p_override_id;

  -- Restore from runtime_config
  IF v_override.override_type = 'difficulty' AND v_override.value_before ? 'difficulty_level' THEN
    SELECT runtime_config INTO v_rc FROM profiles WHERE id = p_profile_id;
    v_rc := COALESCE(v_rc, '{}'::jsonb);
    v_overrides := COALESCE(v_rc->'difficulty_overrides', '{}'::jsonb);
    v_key := COALESCE(v_override.value_before->>'target', '_global');
    v_overrides := v_overrides || jsonb_build_object(v_key, (v_override.value_before->>'difficulty_level')::integer);
    UPDATE profiles SET runtime_config = jsonb_set(COALESCE(runtime_config, '{}'::jsonb), '{difficulty_overrides}', v_overrides) WHERE id = p_profile_id;
  END IF;

  IF v_override.override_type = 'dose_reduction' AND v_override.value_before ? 'target_value' THEN
    UPDATE dose_targets SET effective_until = CURRENT_DATE
    WHERE profile_id = p_profile_id AND domain_slug = v_override.value_before->>'domain_slug' AND effective_until IS NULL;
    INSERT INTO dose_targets (user_id, profile_id, domain_slug, target_value, prescribed_by)
    VALUES (p_user_id, p_profile_id, v_override.value_before->>'domain_slug', (v_override.value_before->>'target_value')::numeric, p_clinician_id);
  END IF;

  IF v_override.override_type = 'cue_level' THEN
    SELECT runtime_config INTO v_rc FROM profiles WHERE id = p_profile_id;
    v_rc := COALESCE(v_rc, '{}'::jsonb);
    v_rc := v_rc || jsonb_build_object('cue_level_override', v_override.value_before->'cue_level', 'cue_review_at', null, 'cue_reviewed_by', null);
    UPDATE profiles SET runtime_config = v_rc WHERE id = p_profile_id;
  END IF;

  IF v_override.override_type = 'practice_assignment' THEN
    SELECT runtime_config INTO v_rc FROM profiles WHERE id = p_profile_id;
    v_rc := COALESCE(v_rc, '{}'::jsonb);
    v_assignments := COALESCE(v_rc->'practice_assignments', '[]'::jsonb);
    v_latest_id := v_override.value_after->'latest'->>'id';
    IF v_latest_id IS NOT NULL THEN
      SELECT jsonb_agg(elem) INTO v_assignments
      FROM jsonb_array_elements(v_assignments) AS elem
      WHERE elem->>'id' != v_latest_id;
      v_assignments := COALESCE(v_assignments, '[]'::jsonb);
    END IF;
    UPDATE profiles SET runtime_config = jsonb_set(COALESCE(runtime_config, '{}'::jsonb), '{practice_assignments}', v_assignments) WHERE id = p_profile_id;
  END IF;

  IF v_override.override_type = 'outreach' THEN
    UPDATE recovery_alerts SET resolved_at = now(), resolved_by = p_clinician_id, resolution_notes = 'Reversed: ' || p_reason
    WHERE profile_id = p_profile_id AND alert_type = 'outreach_needed' AND resolved_at IS NULL;
  END IF;

  INSERT INTO adaptation_events (user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence, value_before, value_after)
  VALUES (p_user_id, p_profile_id, 'clinician_override', 'reverse_override', 'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'override_id', p_override_id, 'override_type', v_override.override_type, 'reason', p_reason),
    v_override.value_after, v_override.value_before);

  RETURN jsonb_build_object('success', true, 'message', 'Override reversed: ' || v_override.override_type);
END;
$$;