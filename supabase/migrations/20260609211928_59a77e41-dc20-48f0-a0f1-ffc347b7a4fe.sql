ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_kind text NOT NULL DEFAULT 'patient';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text;
  v_invite record;
  v_intent text;
  v_account_id uuid;
  v_account_type care_account_type;
  v_profile_kind text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User');
  v_intent := lower(coalesce(new.raw_user_meta_data->>'account_intent', ''));

  if v_intent = 'caregiver' then
    v_account_type := 'family';
    v_profile_kind := 'account_owner';
  else
    v_account_type := 'self';
    v_profile_kind := 'patient';
  end if;

  -- Every new account gets a Care Account it owns.
  insert into public.care_accounts (name, account_type, created_by)
  values (v_name, v_account_type, new.id)
  returning id into v_account_id;

  -- The auth user's own profile record (patient for survivors, account_owner for caregivers).
  insert into public.profiles (user_id, display_name, profile_name, care_account_id, profile_kind)
  values (new.id, v_name, v_name, v_account_id, v_profile_kind);

  -- Owner membership for the auth user.
  insert into public.care_account_members (care_account_id, user_id, member_role, status)
  values (v_account_id, new.id, 'owner', 'active')
  on conflict do nothing;

  -- Caregivers also get an explicit caregiver membership (identity, not patient).
  if v_intent = 'caregiver' then
    insert into public.care_account_members (care_account_id, user_id, member_role, status)
    values (v_account_id, new.id, 'caregiver', 'active')
    on conflict do nothing;
  end if;

  -- Honor a pending role invitation matching this email (case-insensitive)
  if new.email is not null then
    select * into v_invite
    from public.role_invitations
    where lower(email) = lower(new.email)
      and used_at is null
    limit 1;

    if v_invite.id is not null then
      insert into public.user_roles (user_id, role)
      values (new.id, v_invite.role)
      on conflict (user_id, role) do nothing;

      update public.role_invitations
      set used_at = now(), used_by = new.id
      where id = v_invite.id;
    end if;
  end if;

  return new;
end;
$function$;