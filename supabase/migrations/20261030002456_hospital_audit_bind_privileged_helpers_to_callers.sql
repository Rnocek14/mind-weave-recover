-- Hospital audit #80. Applied and role-tested ONLY on isolated staging branch
-- stdiuaxigqttgdwiwbtp as migration 20261030002456; production NOT touched.
--
-- SECURITY DEFINER helpers are public-schema RPCs. Their caller-supplied
-- principal IDs were an enumeration risk: authenticated A could ask about B.
-- Existing RLS ALWAYS uses auth.uid() and must continue to work.
-- Service-role edge functions may inspect explicit principals.
--
-- Reversible rollback (never apply without security review):
-- Restore original helper functions from the pre-migration Supabase schema
-- and GRANT EXECUTE on the functions below to PUBLIC. Rollback would re-open
-- the original principal-enumeration/anonymous-execution vulnerabilities.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT (
    COALESCE(_user_id = auth.uid(), false)
    OR COALESCE(auth.role() = 'service_role', false)
  ) AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_clinician(_clinician_id uuid, _profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT (
    COALESCE(_clinician_id = auth.uid(), false)
    OR COALESCE(auth.role() = 'service_role', false)
  ) AND EXISTS (
    SELECT 1 FROM public.clinician_assignments
    WHERE clinician_id = _clinician_id
      AND profile_id = _profile_id
      AND revoked_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.is_caregiver_for(_caregiver_id uuid, _profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT (
    COALESCE(_caregiver_id = auth.uid(), false)
    OR COALESCE(auth.role() = 'service_role', false)
  ) AND EXISTS (
    SELECT 1 FROM public.caregiver_assignments
    WHERE caregiver_id = _caregiver_id
      AND profile_id = _profile_id
      AND revoked_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.is_care_account_member(_user_id uuid, _account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT (
    COALESCE(_user_id = auth.uid(), false)
    OR COALESCE(auth.role() = 'service_role', false)
  ) AND EXISTS (
    SELECT 1 FROM public.care_account_members
    WHERE user_id = _user_id
      AND care_account_id = _account_id
      AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_care_account_role(
  _user_id uuid, _account_id uuid, _role public.care_account_member_role
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT (
    COALESCE(_user_id = auth.uid(), false)
    OR COALESCE(auth.role() = 'service_role', false)
  ) AND EXISTS (
    SELECT 1 FROM public.care_account_members
    WHERE user_id = _user_id
      AND care_account_id = _account_id
      AND member_role = _role
      AND status = 'active'
  )
$$;

-- All remaining anon-callable public SECURITY DEFINER functions have either
-- user-specific operations or trigger-only purposes; none needs direct
-- anonymous RPC execution. Keep authenticated and service-role access.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true AND p.proname IN (
      'can_view_cluster_analytics',
      'end_session_server',
      'extract_phenotype_from_clinical_profile',
      'handle_new_user',
      'has_care_account_role',
      'is_assigned_clinician',
      'is_care_account_member',
      'is_caregiver_for',
      'is_clinician_or_admin',
      'merge_profile_pref',
      'set_profile_id_from_session',
      'switch_active_profile',
      'validate_functional_checkin'
    )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role;', f.signature);
  END LOOP;
END $$;
