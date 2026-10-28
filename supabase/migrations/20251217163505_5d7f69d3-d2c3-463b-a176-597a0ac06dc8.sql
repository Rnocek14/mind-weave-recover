-- This historical named-account backfill applies only if that auth account exists.
-- Fresh installations must not create a user or assign a substitute administrator.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE id = '3a2ae857-680d-4ceb-af7c-095ae3036b2d';
