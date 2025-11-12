-- Add clinical profile column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS clinical_profile JSONB DEFAULT '{
  "impairments": {
    "motor": [],
    "speech": [],
    "cognitive": [],
    "visual": []
  },
  "stroke_location": null,
  "affected_side": null,
  "therapy_focus": [],
  "severity": {},
  "notes": null,
  "profile_source": "manual",
  "last_updated": null,
  "source_phrases": {}
}'::jsonb;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_clinical_profile ON profiles USING gin(clinical_profile);