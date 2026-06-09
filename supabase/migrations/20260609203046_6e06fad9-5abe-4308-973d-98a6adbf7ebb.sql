-- ============================================================================
-- Care Account Identity Model — Minimal Irreversible Slice
-- ============================================================================

-- 1. Enums -------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.care_account_type AS ENUM ('family', 'self', 'clinic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.care_account_member_role AS ENUM ('owner', 'caregiver', 'patient', 'clinician');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tables ------------------------------------------------------------------
CREATE TABLE public.care_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  account_type public.care_account_type NOT NULL DEFAULT 'self',
  created_by uuid,
  subscription_status text NOT NULL DEFAULT 'none',
  payer_member_id uuid,
  payer_external_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.care_account_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  care_account_id uuid NOT NULL REFERENCES public.care_accounts(id) ON DELETE CASCADE,
  user_id uuid,
  member_role public.care_account_member_role NOT NULL,
  invited_email text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_care_account_members_account ON public.care_account_members(care_account_id);
CREATE INDEX idx_care_account_members_user ON public.care_account_members(user_id) WHERE user_id IS NOT NULL;

-- 3. GRANTs ------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_accounts TO authenticated;
GRANT ALL ON public.care_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_account_members TO authenticated;
GRANT ALL ON public.care_account_members TO service_role;

-- 4. Security-definer helpers (recursion-free) -------------------------------
CREATE OR REPLACE FUNCTION public.is_care_account_member(_user_id uuid, _account_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_account_members
    WHERE care_account_id = _account_id
      AND user_id = _user_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_care_account_role(_user_id uuid, _account_id uuid, _role public.care_account_member_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_account_members
    WHERE care_account_id = _account_id
      AND user_id = _user_id
      AND member_role = _role
      AND status = 'active'
  );
$$;

-- 5. RLS ---------------------------------------------------------------------
ALTER TABLE public.care_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_account_members ENABLE ROW LEVEL SECURITY;

-- care_accounts: members (and admins) read; creator inserts; owner/admin update
CREATE POLICY "Members can view their care accounts"
  ON public.care_accounts FOR SELECT TO authenticated
  USING (public.is_care_account_member(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create care accounts they own"
  ON public.care_accounts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners and admins can update care accounts"
  ON public.care_accounts FOR UPDATE TO authenticated
  USING (public.has_care_account_role(auth.uid(), id, 'owner'::public.care_account_member_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_care_account_role(auth.uid(), id, 'owner'::public.care_account_member_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- care_account_members: members (and admins) read; owner/admin manage
CREATE POLICY "Members can view co-members"
  ON public.care_account_members FOR SELECT TO authenticated
  USING (public.is_care_account_member(auth.uid(), care_account_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can add members"
  ON public.care_account_members FOR INSERT TO authenticated
  WITH CHECK (public.has_care_account_role(auth.uid(), care_account_id, 'owner'::public.care_account_member_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can update members"
  ON public.care_account_members FOR UPDATE TO authenticated
  USING (public.has_care_account_role(auth.uid(), care_account_id, 'owner'::public.care_account_member_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_care_account_role(auth.uid(), care_account_id, 'owner'::public.care_account_member_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can remove members"
  ON public.care_account_members FOR DELETE TO authenticated
  USING (public.has_care_account_role(auth.uid(), care_account_id, 'owner'::public.care_account_member_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 6. updated_at triggers -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_care_accounts_updated_at
  BEFORE UPDATE ON public.care_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_care_account_members_updated_at
  BEFORE UPDATE ON public.care_account_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. profiles columns --------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS care_account_id uuid REFERENCES public.care_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

-- 8. Backfill ----------------------------------------------------------------
-- One care_account per existing auth user; type = 'family' if that user owns
-- multiple profiles, else 'self'. Owner + patient members created per profile.
DO $$
DECLARE
  r_user RECORD;
  r_prof RECORD;
  v_account_id uuid;
  v_profile_count integer;
BEGIN
  FOR r_user IN
    SELECT DISTINCT user_id FROM public.profiles WHERE user_id IS NOT NULL
  LOOP
    SELECT count(*) INTO v_profile_count
    FROM public.profiles WHERE user_id = r_user.user_id;

    INSERT INTO public.care_accounts (name, account_type, created_by)
    VALUES (
      'My Care Account',
      CASE WHEN v_profile_count > 1 THEN 'family'::public.care_account_type
           ELSE 'self'::public.care_account_type END,
      r_user.user_id
    )
    RETURNING id INTO v_account_id;

    -- Owner member (the account holder)
    INSERT INTO public.care_account_members (care_account_id, user_id, member_role, status)
    VALUES (v_account_id, r_user.user_id, 'owner', 'active');

    -- One patient member per profile + link the profile to the account
    FOR r_prof IN
      SELECT id FROM public.profiles WHERE user_id = r_user.user_id
    LOOP
      UPDATE public.profiles SET care_account_id = v_account_id WHERE id = r_prof.id;
      INSERT INTO public.care_account_members (care_account_id, user_id, member_role, status)
      VALUES (v_account_id, r_user.user_id, 'patient', 'active');
    END LOOP;
  END LOOP;
END $$;