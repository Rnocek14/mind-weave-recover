-- True atomic transaction RPCs for clinician actions

-- 1. Atomic dose reduction
CREATE OR REPLACE FUNCTION public.clinician_reduce_dose(
  p_user_id uuid,
  p_profile_id uuid,
  p_clinician_id uuid,
  p_domain_slug text DEFAULT 'speech_therapy',
  p_reduction_pct integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current RECORD;
  v_old_value numeric;
  v_new_value numeric;
  v_override_id uuid;
BEGIN
  SELECT * INTO v_current
  FROM dose_targets
  WHERE profile_id = p_profile_id
    AND domain_slug = p_domain_slug
    AND effective_until IS NULL
  ORDER BY effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active dose target for ' || p_domain_slug);
  END IF;

  v_old_value := v_current.target_value;
  v_new_value := GREATEST(5, ROUND(v_old_value * (1 - p_reduction_pct::numeric / 100)));

  UPDATE dose_targets SET effective_until = CURRENT_DATE WHERE id = v_current.id;

  INSERT INTO dose_targets (user_id, profile_id, domain_slug, target_value, target_frequency, prescribed_by)
  VALUES (p_user_id, p_profile_id, p_domain_slug, v_new_value, v_current.target_frequency, p_clinician_id);

  INSERT INTO clinician_overrides (user_id, profile_id, clinician_id, override_type, target_slug, value_before, value_after, reason, status)
  VALUES (
    p_user_id, p_profile_id, p_clinician_id, 'dose_reduction', p_domain_slug,
    jsonb_build_object('target_value', v_old_value, 'domain_slug', p_domain_slug),
    jsonb_build_object('target_value', v_new_value, 'domain_slug', p_domain_slug),
    'Reduced dose ' || p_reduction_pct || '% via weekly review',
    'active'
  )
  RETURNING id INTO v_override_id;

  INSERT INTO adaptation_events (user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence, value_before, value_after)
  VALUES (
    p_user_id, p_profile_id, 'clinician_override', 'reduce_dose', 'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'domain_slug', p_domain_slug, 'reduction_pct', p_reduction_pct, 'override_id', v_override_id),
    jsonb_build_object('target_value', v_old_value),
    jsonb_build_object('target_value', v_new_value)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Dose reduced ' || v_old_value || ' to ' || v_new_value || 'min for ' || replace(p_domain_slug, '_', ' '), 'override_id', v_override_id);
END;
$$;

-- 2. Atomic difficulty adjustment
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
  v_cp jsonb;
  v_overrides jsonb;
  v_key text;
  v_current_level integer;
  v_new_level integer;
  v_override_id uuid;
BEGIN
  SELECT clinical_profile INTO v_cp FROM profiles WHERE id = p_profile_id;
  v_cp := COALESCE(v_cp, '{}'::jsonb);
  v_overrides := COALESCE(v_cp->'difficulty_overrides', '{}'::jsonb);
  v_key := COALESCE(p_exercise_slug, '_global');
  v_current_level := COALESCE((v_overrides->>v_key)::integer, 0);
  v_new_level := CASE WHEN p_direction = 'increase' THEN v_current_level + 1 ELSE v_current_level - 1 END;

  UPDATE profiles
  SET clinical_profile = jsonb_set(v_cp, '{difficulty_overrides}', v_overrides || jsonb_build_object(v_key, v_new_level))
  WHERE id = p_profile_id;

  INSERT INTO clinician_overrides (user_id, profile_id, clinician_id, override_type, target_slug, value_before, value_after, reason, status)
  VALUES (
    p_user_id, p_profile_id, p_clinician_id, 'difficulty', p_exercise_slug,
    jsonb_build_object('difficulty_level', v_current_level, 'target', v_key),
    jsonb_build_object('difficulty_level', v_new_level, 'target', v_key),
    'Clinician ' || p_direction || 'd difficulty via weekly review',
    'active'
  )
  RETURNING id INTO v_override_id;

  UPDATE clinician_overrides
  SET status = 'superseded'
  WHERE profile_id = p_profile_id
    AND override_type = 'difficulty'
    AND status = 'active'
    AND id != v_override_id
    AND (target_slug IS NOT DISTINCT FROM p_exercise_slug);

  INSERT INTO recovery_alerts (user_id, profile_id, alert_type, severity, title, description, trigger_data)
  VALUES (
    p_user_id, p_profile_id, 'difficulty_adjustment', 'info',
    'Difficulty ' || CASE WHEN p_direction = 'increase' THEN 'Increased' ELSE 'Decreased' END,
    'Clinician ' || p_direction || 'd difficulty' || CASE WHEN p_exercise_slug IS NOT NULL THEN ' for ' || replace(p_exercise_slug, '-', ' ') ELSE ' globally' END || '.',
    jsonb_build_object('created_by', p_clinician_id, 'direction', p_direction, 'override_id', v_override_id, 'source', 'clinician_override')
  );

  INSERT INTO adaptation_events (user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence, value_before, value_after)
  VALUES (
    p_user_id, p_profile_id, 'clinician_override', p_direction || '_difficulty', 'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'direction', p_direction, 'exercise_slug', COALESCE(p_exercise_slug, 'all'), 'override_id', v_override_id),
    jsonb_build_object('difficulty_level', v_current_level),
    jsonb_build_object('difficulty_level', v_new_level)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Difficulty ' || p_direction || 'd (' || v_current_level || ' to ' || v_new_level || ')', 'override_id', v_override_id);
END;
$$;

-- 3. Atomic override reversal
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
  v_cp jsonb;
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

  IF v_override.override_type = 'difficulty' AND v_override.value_before ? 'difficulty_level' THEN
    SELECT clinical_profile INTO v_cp FROM profiles WHERE id = p_profile_id;
    v_cp := COALESCE(v_cp, '{}'::jsonb);
    v_overrides := COALESCE(v_cp->'difficulty_overrides', '{}'::jsonb);
    v_key := COALESCE(v_override.value_before->>'target', '_global');
    v_overrides := v_overrides || jsonb_build_object(v_key, (v_override.value_before->>'difficulty_level')::integer);
    UPDATE profiles SET clinical_profile = jsonb_set(v_cp, '{difficulty_overrides}', v_overrides) WHERE id = p_profile_id;
  END IF;

  IF v_override.override_type = 'dose_reduction' AND v_override.value_before ? 'target_value' THEN
    UPDATE dose_targets SET effective_until = CURRENT_DATE
    WHERE profile_id = p_profile_id AND domain_slug = v_override.value_before->>'domain_slug' AND effective_until IS NULL;
    INSERT INTO dose_targets (user_id, profile_id, domain_slug, target_value, prescribed_by)
    VALUES (p_user_id, p_profile_id, v_override.value_before->>'domain_slug', (v_override.value_before->>'target_value')::numeric, p_clinician_id);
  END IF;

  IF v_override.override_type = 'cue_level' THEN
    SELECT clinical_profile INTO v_cp FROM profiles WHERE id = p_profile_id;
    v_cp := COALESCE(v_cp, '{}'::jsonb);
    v_cp := v_cp || jsonb_build_object('cue_level_override', v_override.value_before->'cue_level', 'cue_review_at', null, 'cue_reviewed_by', null);
    UPDATE profiles SET clinical_profile = v_cp WHERE id = p_profile_id;
  END IF;

  IF v_override.override_type = 'practice_assignment' THEN
    SELECT clinical_profile INTO v_cp FROM profiles WHERE id = p_profile_id;
    v_cp := COALESCE(v_cp, '{}'::jsonb);
    v_assignments := COALESCE(v_cp->'practice_assignments', '[]'::jsonb);
    v_latest_id := v_override.value_after->'latest'->>'id';
    IF v_latest_id IS NOT NULL THEN
      SELECT jsonb_agg(elem) INTO v_assignments
      FROM jsonb_array_elements(v_assignments) AS elem
      WHERE elem->>'id' != v_latest_id;
      v_assignments := COALESCE(v_assignments, '[]'::jsonb);
    END IF;
    UPDATE profiles SET clinical_profile = jsonb_set(v_cp, '{practice_assignments}', v_assignments) WHERE id = p_profile_id;
  END IF;

  IF v_override.override_type = 'outreach' THEN
    UPDATE recovery_alerts SET resolved_at = now(), resolved_by = p_clinician_id, resolution_notes = 'Reversed: ' || p_reason
    WHERE profile_id = p_profile_id AND alert_type = 'outreach_needed' AND resolved_at IS NULL;
  END IF;

  INSERT INTO adaptation_events (user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence, value_before, value_after)
  VALUES (
    p_user_id, p_profile_id, 'clinician_override', 'reverse_override', 'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'override_id', p_override_id, 'override_type', v_override.override_type, 'reason', p_reason),
    v_override.value_after, v_override.value_before
  );

  RETURN jsonb_build_object('success', true, 'message', 'Override reversed: ' || v_override.override_type);
END;
$$;