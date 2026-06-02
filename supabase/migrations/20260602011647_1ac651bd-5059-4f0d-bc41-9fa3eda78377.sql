-- Fix cross-profile achievement collision: scope uniqueness to profile_id instead of user_id
ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_user_id_type_key;
DROP INDEX IF EXISTS public.achievements_user_id_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS achievements_profile_id_type_key
  ON public.achievements USING btree (profile_id, type);