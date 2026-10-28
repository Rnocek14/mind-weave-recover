-- This historical named-account backfill applies only if that auth account exists.
-- Fresh installations must not create a user or assign a substitute administrator.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE id = 'b77d85ee-c53c-4e99-b4ca-d4eb9a244f8d'
ON CONFLICT (user_id, role) DO NOTHING;
