
-- RPC: Create a suggested override (does NOT apply to runtime_config yet)
CREATE OR REPLACE FUNCTION public.clinician_suggest_override(
  p_user_id uuid,
  p_profile_id uuid,
  p_suggested_by text,
  p_override_type text,
  p_target_slug text DEFAULT NULL,
  p_value_after jsonb DEFAULT '{}'::jsonb,
  p_reason text DEFAULT 'System-suggested change'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_override_id uuid;
  v_value_before jsonb;
BEGIN
  -- Capture current state as value_before
  IF p_override_type = 'difficulty' THEN
    SELECT COALESCE(
      runtime_config->'difficulty_overrides'->COALESCE(p_target_slug, '_global'),
      '0'::jsonb
    ) INTO v_value_before FROM profiles WHERE id = p_profile_id;
    v_value_before := jsonb_build_object('difficulty_level', v_value_before, 'target', COALESCE(p_target_slug, '_global'));
  ELSIF p_override_type = 'cue_level' THEN
    SELECT COALESCE(runtime_config->'cue_level_override', 'null'::jsonb)
    INTO v_value_before FROM profiles WHERE id = p_profile_id;
    v_value_before := jsonb_build_object('cue_level', v_value_before);
  ELSE
    v_value_before := '{}'::jsonb;
  END IF;

  -- Create override in 'suggested' status — does NOT write to runtime_config
  INSERT INTO clinician_overrides (
    user_id, profile_id, clinician_id, override_type, target_slug,
    value_before, value_after, reason, status, suggested_by, suggested_at
  ) VALUES (
    p_user_id, p_profile_id, p_user_id, p_override_type, p_target_slug,
    v_value_before, p_value_after, p_reason, 'suggested', p_suggested_by, now()
  ) RETURNING id INTO v_override_id;

  -- Log the suggestion event
  INSERT INTO adaptation_events (
    user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence
  ) VALUES (
    p_user_id, p_profile_id, 'system_suggestion', 'suggest_' || p_override_type,
    'system_rule', 'medium',
    jsonb_build_object('suggested_by', p_suggested_by, 'override_id', v_override_id, 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Suggestion created for clinician review', 'override_id', v_override_id);
END;
$$;

-- RPC: Approve a suggested override (applies it to runtime_config)
CREATE OR REPLACE FUNCTION public.clinician_approve_override(
  p_user_id uuid,
  p_profile_id uuid,
  p_clinician_id uuid,
  p_override_id uuid
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
BEGIN
  SELECT * INTO v_override FROM clinician_overrides WHERE id = p_override_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Override not found');
  END IF;
  IF v_override.status != 'suggested' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Override is not in suggested status (current: ' || v_override.status || ')');
  END IF;

  -- Mark as approved + active
  UPDATE clinician_overrides
  SET status = 'active', approved_by = p_clinician_id, approved_at = now()
  WHERE id = p_override_id;

  -- Supersede prior active overrides of the same type + target
  UPDATE clinician_overrides
  SET status = 'superseded'
  WHERE profile_id = p_profile_id
    AND override_type = v_override.override_type
    AND status = 'active'
    AND id != p_override_id
    AND (target_slug IS NOT DISTINCT FROM v_override.target_slug);

  -- Now apply to runtime_config based on type
  SELECT runtime_config INTO v_rc FROM profiles WHERE id = p_profile_id;
  v_rc := COALESCE(v_rc, '{}'::jsonb);

  IF v_override.override_type = 'difficulty' THEN
    v_overrides := COALESCE(v_rc->'difficulty_overrides', '{}'::jsonb);
    v_key := COALESCE(v_override.target_slug, '_global');
    v_overrides := v_overrides || jsonb_build_object(v_key, (v_override.value_after->>'difficulty_level')::integer);
    UPDATE profiles SET runtime_config = jsonb_set(v_rc, '{difficulty_overrides}', v_overrides) WHERE id = p_profile_id;

  ELSIF v_override.override_type = 'cue_level' THEN
    v_rc := v_rc || jsonb_build_object(
      'cue_level_override', v_override.value_after->'cue_level',
      'cue_review_at', now()::text,
      'cue_reviewed_by', p_clinician_id::text
    );
    UPDATE profiles SET runtime_config = v_rc WHERE id = p_profile_id;

  ELSIF v_override.override_type = 'dose_reduction' THEN
    -- Apply dose reduction
    UPDATE dose_targets SET effective_until = CURRENT_DATE
    WHERE profile_id = p_profile_id
      AND domain_slug = COALESCE(v_override.value_after->>'domain_slug', 'speech_therapy')
      AND effective_until IS NULL;
    INSERT INTO dose_targets (user_id, profile_id, domain_slug, target_value, prescribed_by)
    VALUES (p_user_id, p_profile_id,
      COALESCE(v_override.value_after->>'domain_slug', 'speech_therapy'),
      (v_override.value_after->>'target_value')::numeric,
      p_clinician_id);
  END IF;

  -- Audit log
  INSERT INTO adaptation_events (
    user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence, value_before, value_after
  ) VALUES (
    p_user_id, p_profile_id, 'clinician_override', 'approve_' || v_override.override_type,
    'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'override_id', p_override_id, 'original_suggestion_by', v_override.suggested_by),
    v_override.value_before, v_override.value_after
  );

  RETURN jsonb_build_object('success', true, 'message', 'Override approved and applied: ' || v_override.override_type, 'override_id', p_override_id);
END;
$$;

-- RPC: Reject a suggested override
CREATE OR REPLACE FUNCTION public.clinician_reject_override(
  p_user_id uuid,
  p_profile_id uuid,
  p_clinician_id uuid,
  p_override_id uuid,
  p_reason text DEFAULT 'Clinician declined suggestion'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_override RECORD;
BEGIN
  SELECT * INTO v_override FROM clinician_overrides WHERE id = p_override_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Override not found');
  END IF;
  IF v_override.status != 'suggested' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Override is not in suggested status');
  END IF;

  UPDATE clinician_overrides
  SET status = 'reversed', reversed_at = now(), reversed_by = p_clinician_id, reversal_reason = p_reason
  WHERE id = p_override_id;

  INSERT INTO adaptation_events (
    user_id, profile_id, layer, adaptation_type, trigger_type, confidence, evidence
  ) VALUES (
    p_user_id, p_profile_id, 'clinician_override', 'reject_' || v_override.override_type,
    'clinician_action', 'high',
    jsonb_build_object('performed_by', p_clinician_id, 'override_id', p_override_id, 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Suggestion rejected', 'override_id', p_override_id);
END;
$$;
