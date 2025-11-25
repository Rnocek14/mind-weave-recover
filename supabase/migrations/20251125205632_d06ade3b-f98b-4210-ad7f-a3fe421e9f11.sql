-- Views don't support RLS policies directly, but we can control access via grants
-- First, revoke public access
REVOKE ALL ON cluster_learning_rates FROM PUBLIC;
REVOKE ALL ON cluster_learning_rates FROM authenticated;
REVOKE ALL ON cluster_learning_rates FROM anon;

-- Create a policy function for the view access
CREATE OR REPLACE FUNCTION public.can_view_cluster_analytics()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'admin'::app_role);
$$;

-- Grant SELECT to authenticated users, but they'll need to pass through get_cluster_learning_rates function
-- This function will check permissions
CREATE OR REPLACE FUNCTION public.get_cluster_learning_rates()
RETURNS SETOF cluster_learning_rates
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM cluster_learning_rates
  WHERE has_role(auth.uid(), 'admin'::app_role);
$$;

-- Add helpful comment
COMMENT ON FUNCTION public.get_cluster_learning_rates IS 'Secure access to cluster learning rates. Only admins can view this aggregated analytics data. Use this function instead of querying the view directly.';