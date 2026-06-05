-- Profiles: remove broad clinician-sees-all, keep admin-sees-all + assigned-clinician
DROP POLICY IF EXISTS "Clinicians view all profiles" ON public.profiles;

CREATE POLICY "Admins view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- user_roles: remove broad clinician-sees-all-roles, keep admin-only
DROP POLICY IF EXISTS "Clinicians view all roles" ON public.user_roles;

CREATE POLICY "Admins view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));