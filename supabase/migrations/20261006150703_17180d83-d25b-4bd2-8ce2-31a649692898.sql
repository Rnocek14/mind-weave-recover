-- This historical named-account backfill applies only if that auth account exists.
-- Fresh installations must not create a user or assign a substitute administrator.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE id = 'cea653c5-99c3-4b61-98bf-e25a0b0d5c96'
ON CONFLICT (user_id, role) DO NOTHING;
