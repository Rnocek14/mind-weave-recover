-- Create materialized view for efficient cluster assignments
CREATE MATERIALIZED VIEW user_cluster_assignments AS
SELECT 
  p.user_id,
  p.stroke_date,
  EXTRACT(EPOCH FROM (NOW() - p.stroke_date))/2592000 AS months_since_stroke,
  CASE 
    WHEN p.stroke_date IS NULL THEN 'unknown'
    WHEN EXTRACT(EPOCH FROM (NOW() - p.stroke_date))/2592000 < 6 THEN 'acute'
    WHEN EXTRACT(EPOCH FROM (NOW() - p.stroke_date))/2592000 < 12 THEN 'subacute'
    ELSE 'chronic'
  END AS chronicity,
  COALESCE(p.clinical_profile->>'stroke_mechanism', 'unknown') AS stroke_mechanism,
  COALESCE(p.clinical_profile->>'affected_side', 'unknown') AS hemisphere,
  COALESCE(p.clinical_profile->>'stroke_location', 'unspecified') AS lesion_zone,
  -- Generate cluster key for grouping
  CONCAT_WS('_',
    COALESCE(p.clinical_profile->>'stroke_mechanism', 'unknown'),
    COALESCE(p.clinical_profile->>'affected_side', 'unknown'),
    COALESCE(
      CASE 
        WHEN p.clinical_profile->>'stroke_location' LIKE '%motor%' THEN 'motor_cortex'
        WHEN p.clinical_profile->>'stroke_location' LIKE '%language%' OR p.clinical_profile->>'stroke_location' LIKE '%speech%' THEN 'language_area'
        WHEN p.clinical_profile->>'stroke_location' LIKE '%visual%' THEN 'visual_cortex'
        WHEN p.clinical_profile->>'stroke_location' LIKE '%brainstem%' THEN 'brainstem'
        ELSE 'unspecified'
      END,
      'unspecified'
    ),
    CASE 
      WHEN p.stroke_date IS NULL THEN 'unknown'
      WHEN EXTRACT(EPOCH FROM (NOW() - p.stroke_date))/2592000 < 6 THEN 'acute'
      WHEN EXTRACT(EPOCH FROM (NOW() - p.stroke_date))/2592000 < 12 THEN 'subacute'
      ELSE 'chronic'
    END
  ) AS cluster_key
FROM profiles p
WHERE p.user_id IS NOT NULL;

-- Create index on cluster_key for fast grouping
CREATE INDEX idx_cluster_key ON user_cluster_assignments(cluster_key);

-- Create index on user_id for fast lookups
CREATE UNIQUE INDEX idx_user_cluster_assignment ON user_cluster_assignments(user_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_cluster_assignments()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_cluster_assignments;
END;
$$;

-- Grant access to authenticated users (for the hook to query)
GRANT SELECT ON user_cluster_assignments TO authenticated;