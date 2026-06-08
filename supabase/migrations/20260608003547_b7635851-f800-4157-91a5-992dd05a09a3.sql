DO $$
DECLARE
  v_clinician_id uuid := gen_random_uuid();
  v_caregiver_id uuid := gen_random_uuid();
BEGIN
  -- Clinician demo account
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    v_clinician_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'demo.clinician@gmail.com', crypt('demo1234', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Clinician"}'::jsonb, '', '', '', ''
  );
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_clinician_id, v_clinician_id::text,
    jsonb_build_object('sub', v_clinician_id::text, 'email', 'demo.clinician@gmail.com', 'email_verified', true),
    'email', now(), now(), now()
  );

  -- Caregiver demo account
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    v_caregiver_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'demo.caregiver@gmail.com', crypt('demo1234', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Caregiver"}'::jsonb, '', '', '', ''
  );
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_caregiver_id, v_caregiver_id::text,
    jsonb_build_object('sub', v_caregiver_id::text, 'email', 'demo.caregiver@gmail.com', 'email_verified', true),
    'email', now(), now(), now()
  );
END $$;