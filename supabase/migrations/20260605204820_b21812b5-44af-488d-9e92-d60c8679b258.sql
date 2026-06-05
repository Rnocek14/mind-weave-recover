-- 1) Invitations table
CREATE TABLE public.role_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_by uuid
);

-- One active invitation per email (case-insensitive)
CREATE UNIQUE INDEX role_invitations_email_unique
  ON public.role_invitations (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_invitations TO authenticated;
GRANT ALL ON public.role_invitations TO service_role;

ALTER TABLE public.role_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage role invitations"
  ON public.role_invitations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Auto-provision role on signup based on a matching invitation
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text;
  v_invite record;
begin
  v_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User');
  insert into public.profiles (user_id, display_name, profile_name) values (new.id, v_name, v_name);

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