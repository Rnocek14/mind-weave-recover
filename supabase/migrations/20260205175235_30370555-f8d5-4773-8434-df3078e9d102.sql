-- Add 'caregiver' to the app_role enum if it doesn't exist
DO $$
BEGIN
  -- Check if 'caregiver' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'caregiver' 
    AND enumtypid = 'public.app_role'::regtype
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'caregiver';
  END IF;
END $$;