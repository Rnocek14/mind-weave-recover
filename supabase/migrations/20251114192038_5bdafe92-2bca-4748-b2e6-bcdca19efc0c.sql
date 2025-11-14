-- Enable RLS on the materialized view
ALTER MATERIALIZED VIEW user_cluster_assignments OWNER TO postgres;

-- Create RLS policy for admin access only
-- Note: Materialized views don't support RLS directly, so we'll create a security definer function instead

-- Revoke direct access
REVOKE SELECT ON user_cluster_assignments FROM authenticated;
REVOKE SELECT ON user_cluster_assignments FROM anon;

-- Create secure function for admin access only
CREATE OR REPLACE FUNCTION get_cluster_assignments()
RETURNS SETOF user_cluster_assignments
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only allow admins to access cluster data
  SELECT * FROM user_cluster_assignments
  WHERE has_role(auth.uid(), 'admin'::app_role);
$$;

-- Grant execute to authenticated users (function will check role)
GRANT EXECUTE ON FUNCTION get_cluster_assignments() TO authenticated;