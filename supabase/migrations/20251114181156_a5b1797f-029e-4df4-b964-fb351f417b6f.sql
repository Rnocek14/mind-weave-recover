-- Add stroke_date field to profiles table for temporal analysis
ALTER TABLE profiles 
ADD COLUMN stroke_date DATE;

-- Add index for filtering by stroke_date
CREATE INDEX idx_profiles_stroke_date ON profiles(stroke_date) 
WHERE stroke_date IS NOT NULL;

COMMENT ON COLUMN profiles.stroke_date IS 'Date of stroke event for temporal analysis and cohort filtering';