CREATE OR REPLACE FUNCTION public.admin_user_overview()
RETURNS TABLE (
  user_id uuid,
  email text,
  is_anonymous boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  roles text[],
  profile_names text[],
  session_count bigint,
  completed_session_count bigint,
  last_session_at timestamptz,
  total_practice_minutes numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.email::text,
    COALESCE(u.is_anonymous, false),
    u.created_at,
    u.last_sign_in_at,
    COALESCE(r.roles, ARRAY[]::text[]),
    COALESCE(p.names, ARRAY[]::text[]),
    COALESCE(s.total, 0),
    COALESCE(s.completed, 0),
    s.last_at,
    ROUND(COALESCE(s.secs, 0) / 60.0, 1)
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT array_agg(ur.role::text ORDER BY ur.role::text) AS roles
    FROM public.user_roles ur WHERE ur.user_id = u.id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT array_agg(COALESCE(pr.profile_name, pr.display_name) ORDER BY pr.created_at) AS names
    FROM public.profiles pr WHERE pr.user_id = u.id
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS total,
           count(*) FILTER (WHERE se.ended_at IS NOT NULL) AS completed,
           max(se.started_at) AS last_at,
           sum(COALESCE(se.duration_sec, 0)) AS secs
    FROM public.sessions se WHERE se.user_id = u.id
  ) s ON true
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY s.last_at DESC NULLS LAST, u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_user_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_overview() TO authenticated;