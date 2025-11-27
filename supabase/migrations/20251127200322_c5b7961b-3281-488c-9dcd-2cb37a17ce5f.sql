-- Step 1: Add unique constraint on user_id (will be needed after we drop primary key)
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Step 2: Drop old primary key with cascade
ALTER TABLE public.profiles DROP CONSTRAINT profiles_pkey CASCADE;

-- Step 3: Add new primary key on id column
ALTER TABLE public.profiles ADD PRIMARY KEY (id);

-- Step 4: Recreate foreign keys referencing user_id (now has unique constraint)
ALTER TABLE public.sessions 
  ADD CONSTRAINT sessions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.photos
  ADD CONSTRAINT photos_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.clinical_notes
  ADD CONSTRAINT clinical_notes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.clinical_notes
  ADD CONSTRAINT clinical_notes_uploaded_by_fkey 
  FOREIGN KEY (uploaded_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.clinical_notes
  ADD CONSTRAINT clinical_notes_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.clinical_profile_versions
  ADD CONSTRAINT clinical_profile_versions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.clinical_profile_versions
  ADD CONSTRAINT clinical_profile_versions_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.clinical_profile_versions
  ADD CONSTRAINT clinical_profile_versions_validated_by_fkey 
  FOREIGN KEY (validated_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.profile_merge_conflicts
  ADD CONSTRAINT profile_merge_conflicts_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.profile_merge_conflicts
  ADD CONSTRAINT profile_merge_conflicts_resolved_by_fkey 
  FOREIGN KEY (resolved_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;