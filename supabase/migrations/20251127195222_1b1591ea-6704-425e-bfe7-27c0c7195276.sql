-- Step 1: Add new columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() NOT NULL,
  ADD COLUMN IF NOT EXISTS profile_name TEXT,
  ADD COLUMN IF NOT EXISTS birthdate DATE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS profile_created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Step 2: Make id unique (required for foreign key references)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_unique UNIQUE (id);

-- Step 3: Populate profile_name for existing profiles
UPDATE public.profiles
SET profile_name = COALESCE(display_name, 'Default Profile')
WHERE profile_name IS NULL;

-- Step 4: Make profile_name required and add unique constraint
ALTER TABLE public.profiles
  ALTER COLUMN profile_name SET NOT NULL,
  ADD CONSTRAINT profiles_user_profile_unique UNIQUE (user_id, profile_name);

-- Step 5: Add profile_id columns to related tables
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.clinical_notes ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.functional_goals ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.learning_rates ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.standardized_assessments ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.capability_assessments ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.recovery_summaries ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.outcome_predictions ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.dismissed_flags ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.clinical_profile_versions ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.profile_merge_conflicts ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE public.clinical_profile_corrections ADD COLUMN IF NOT EXISTS profile_id UUID;

-- Step 6: Populate profile_id by matching user_id
UPDATE public.sessions s SET profile_id = p.id FROM public.profiles p WHERE s.user_id = p.user_id AND s.profile_id IS NULL;
UPDATE public.achievements a SET profile_id = p.id FROM public.profiles p WHERE a.user_id = p.user_id AND a.profile_id IS NULL;
UPDATE public.photos ph SET profile_id = p.id FROM public.profiles p WHERE ph.user_id = p.user_id AND ph.profile_id IS NULL;
UPDATE public.clinical_notes cn SET profile_id = p.id FROM public.profiles p WHERE cn.user_id = p.user_id AND cn.profile_id IS NULL;
UPDATE public.functional_goals fg SET profile_id = p.id FROM public.profiles p WHERE fg.user_id = p.user_id AND fg.profile_id IS NULL;
UPDATE public.learning_rates lr SET profile_id = p.id FROM public.profiles p WHERE lr.user_id = p.user_id AND lr.profile_id IS NULL;
UPDATE public.standardized_assessments sa SET profile_id = p.id FROM public.profiles p WHERE sa.user_id = p.user_id AND sa.profile_id IS NULL;
UPDATE public.capability_assessments ca SET profile_id = p.id FROM public.profiles p WHERE ca.user_id = p.user_id AND ca.profile_id IS NULL;
UPDATE public.recovery_summaries rs SET profile_id = p.id FROM public.profiles p WHERE rs.user_id = p.user_id AND rs.profile_id IS NULL;
UPDATE public.outcome_predictions op SET profile_id = p.id FROM public.profiles p WHERE op.user_id = p.user_id AND op.profile_id IS NULL;
UPDATE public.dismissed_flags df SET profile_id = p.id FROM public.profiles p WHERE df.user_id = p.user_id AND df.profile_id IS NULL;
UPDATE public.clinical_profile_versions cpv SET profile_id = p.id FROM public.profiles p WHERE cpv.user_id = p.user_id AND cpv.profile_id IS NULL;
UPDATE public.profile_merge_conflicts pmc SET profile_id = p.id FROM public.profiles p WHERE pmc.user_id = p.user_id AND pmc.profile_id IS NULL;
UPDATE public.clinical_profile_corrections cpc SET profile_id = p.id FROM public.profiles p WHERE cpc.user_id = p.user_id AND cpc.profile_id IS NULL;

-- Step 7: Add foreign key constraints
ALTER TABLE public.sessions ADD CONSTRAINT sessions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.photos ADD CONSTRAINT photos_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.clinical_notes ADD CONSTRAINT clinical_notes_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.functional_goals ADD CONSTRAINT functional_goals_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.learning_rates ADD CONSTRAINT learning_rates_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.standardized_assessments ADD CONSTRAINT standardized_assessments_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.capability_assessments ADD CONSTRAINT capability_assessments_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.recovery_summaries ADD CONSTRAINT recovery_summaries_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.outcome_predictions ADD CONSTRAINT outcome_predictions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.dismissed_flags ADD CONSTRAINT dismissed_flags_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.clinical_profile_versions ADD CONSTRAINT clinical_profile_versions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.profile_merge_conflicts ADD CONSTRAINT profile_merge_conflicts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.clinical_profile_corrections ADD CONSTRAINT clinical_profile_corrections_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;