-- This historical named-account backfill applies only if that auth account exists.
-- Fresh installations must not create a user or assign a substitute administrator.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE id = '552cc0b2-5e3c-4a98-b3fd-9f7ef3bd713d'
ON CONFLICT (user_id, role) DO NOTHING;