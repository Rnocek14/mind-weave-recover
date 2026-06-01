INSERT INTO public.user_roles (user_id, role)
VALUES ('b77d85ee-c53c-4e99-b4ca-d4eb9a244f8d', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;