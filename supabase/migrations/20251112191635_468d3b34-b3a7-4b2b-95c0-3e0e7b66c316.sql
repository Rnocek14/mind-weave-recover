-- Add function to merge profile preferences (for difficulty levels, etc.)
create or replace function public.merge_profile_pref(
  p_key text,
  p_subkey text,
  p_value jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set accessibility_prefs = coalesce(accessibility_prefs, '{}'::jsonb)
    || jsonb_build_object(
         p_key,
         coalesce(accessibility_prefs->p_key, '{}'::jsonb) 
         || jsonb_build_object(p_subkey, p_value)
       )
  where user_id = auth.uid();
end;
$$;