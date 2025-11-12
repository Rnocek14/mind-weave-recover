-- Create a function to set up the first admin user
-- This uses SECURITY DEFINER to bypass RLS policies
CREATE OR REPLACE FUNCTION public.setup_admin_user(admin_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get the user ID for the given email
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email;
  
  -- If user exists, insert admin role (ignore if already exists)
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;