-- Learning Rate Intelligence: Individual + Cluster Analysis

-- 1. Learning rates table (per user, per domain, per time window)
CREATE TABLE IF NOT EXISTS learning_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL, -- 'phonological', 'semantic', 'grammar', 'motor', 'visuospatial', 'executive'
  time_window_days INTEGER NOT NULL, -- 7, 14, 30
  
  -- Core metrics
  accuracy_slope NUMERIC(8,6), -- % improvement per day (e.g., 0.008500 = +0.85%/day)
  rt_slope NUMERIC(8,2), -- reaction time change per day (ms/day, negative = faster)
  trial_count INTEGER NOT NULL DEFAULT 0,
  
  -- Context
  start_accuracy NUMERIC(5,4), -- 0-1 scale
  end_accuracy NUMERIC(5,4),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  confidence_score NUMERIC(3,2) DEFAULT 0.5, -- 0-1, based on sample size
  
  UNIQUE(user_id, domain, time_window_days, end_date)
);

CREATE INDEX idx_learning_rates_user_domain ON learning_rates(user_id, domain, calculated_at DESC);
CREATE INDEX idx_learning_rates_window ON learning_rates(time_window_days, end_date DESC);

ALTER TABLE learning_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own learning rates" 
  ON learning_rates FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins access all learning rates" 
  ON learning_rates FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- 2. Cluster learning rate aggregates view
CREATE OR REPLACE VIEW cluster_learning_rates AS
SELECT
  c.cluster_key,
  c.stroke_mechanism,
  c.hemisphere,
  c.lesion_zone,
  c.chronicity,
  lr.domain,
  lr.time_window_days,
  
  -- Aggregate metrics
  AVG(lr.accuracy_slope) AS avg_accuracy_slope,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lr.accuracy_slope) AS median_accuracy_slope,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY lr.accuracy_slope) AS p25_accuracy_slope,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY lr.accuracy_slope) AS p75_accuracy_slope,
  STDDEV_POP(lr.accuracy_slope) AS sd_accuracy_slope,
  
  AVG(lr.rt_slope) AS avg_rt_slope,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lr.rt_slope) AS median_rt_slope,
  
  AVG(lr.confidence_score) AS avg_confidence,
  COUNT(DISTINCT lr.user_id) AS user_count,
  SUM(lr.trial_count) AS total_trials,
  
  MAX(lr.calculated_at) AS last_updated
FROM learning_rates lr
JOIN user_cluster_assignments c ON c.user_id = lr.user_id
WHERE lr.calculated_at > NOW() - INTERVAL '90 days' -- Only recent data
GROUP BY 
  c.cluster_key, 
  c.stroke_mechanism, 
  c.hemisphere, 
  c.lesion_zone, 
  c.chronicity,
  lr.domain, 
  lr.time_window_days
HAVING COUNT(DISTINCT lr.user_id) >= 3; -- Need at least 3 users for meaningful stats

-- Grant access to cluster view
GRANT SELECT ON cluster_learning_rates TO authenticated;

COMMENT ON TABLE learning_rates IS 'Tracks learning velocity (improvement rate) per user, domain, and time window';
COMMENT ON COLUMN learning_rates.accuracy_slope IS 'Daily improvement rate as decimal (0.01 = +1%/day)';
COMMENT ON COLUMN learning_rates.rt_slope IS 'Daily reaction time change in ms (negative = getting faster)';
COMMENT ON COLUMN learning_rates.confidence_score IS 'Statistical confidence based on sample size (0-1)';
COMMENT ON VIEW cluster_learning_rates IS 'Aggregated learning rates by patient cluster for cohort comparison';