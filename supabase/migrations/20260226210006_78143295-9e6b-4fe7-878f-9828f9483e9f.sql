-- Add generated column for upsert-safe unique constraint
ALTER TABLE cognitive_domain_scores
ADD COLUMN profile_key uuid GENERATED ALWAYS AS (COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED;

-- Drop old expression index (PostgREST can't use it for onConflict)
DROP INDEX IF EXISTS idx_cognitive_domain_scores_upsert;

-- Add real unique constraint on the generated column
ALTER TABLE cognitive_domain_scores
ADD CONSTRAINT uq_cognitive_scores_user_domain_window
UNIQUE (user_id, profile_key, domain_slug, window_end, granularity);