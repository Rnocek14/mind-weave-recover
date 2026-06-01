CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User');
  insert into public.profiles (user_id, display_name, profile_name) values (new.id, v_name, v_name);
  return new;
end; $function$;

INSERT INTO public.user_roles (user_id, role)
VALUES ('b77d85ee-c53c-4e99-b4ca-d4eb9a244f8d', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;