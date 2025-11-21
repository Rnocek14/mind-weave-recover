# Database Schema Documentation

## Tables

### clinical_notes

Stores all raw clinical documents (MRI, CT, discharge notes, etc.) with metadata and parsing status.

**Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `user_id` (UUID, Required) - References profiles.user_id
- `note_type` (TEXT, Required) - Type: 'mri_report', 'ct_scan', 'discharge_summary', 'progress_note', 'neuropsych_eval', 'initial_assessment', 'other'
- `document_date` (DATE, Required) - Date the document was created (e.g., scan date)
- `uploaded_at` (TIMESTAMPTZ, Default: NOW()) - When document was uploaded
- `uploaded_by` (UUID) - References profiles.user_id
- `raw_text` (TEXT, Required) - Original unprocessed text
- `document_title` (TEXT) - Optional title
- `source_system` (TEXT) - e.g., 'epic', 'cerner', 'manual_upload'
- `scan_details` (JSONB, Default: {}) - Document-specific metadata
- `parsed_at` (TIMESTAMPTZ) - When the document was parsed by AI
- `parser_version` (TEXT) - Version of parser used
- `parsing_confidence` (TEXT) - 'high', 'medium', 'low'
- `extracted_profile` (JSONB, Default: {}) - Extracted clinical profile data
- `notes` (TEXT) - Additional notes
- `requires_review` (BOOLEAN, Default: false) - Flag for manual review
- `reviewed_by` (UUID) - References profiles.user_id
- `reviewed_at` (TIMESTAMPTZ) - When reviewed
- `created_at` (TIMESTAMPTZ, Default: NOW())

**Indexes:**
- `idx_clinical_notes_user_date` - On (user_id, document_date DESC)
- `idx_clinical_notes_type` - On (user_id, note_type)
- `idx_clinical_notes_uploaded` - On (user_id, uploaded_at DESC)

**RLS Policies:**
- Users can view/insert/update/delete their own notes
- Admins can view all notes

---

### clinical_profile_versions

Tracks version history of clinical profiles with full audit trail.

**Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `user_id` (UUID, Required) - References profiles.user_id
- `version_number` (INTEGER, Required) - Sequential version (1, 2, 3, etc.)
- `is_active` (BOOLEAN, Default: true) - Only one active version per user
- `profile_data` (JSONB, Required) - Full snapshot of clinical profile
- `source_type` (TEXT, Required) - 'initial_onboarding', 'note_parsing', 'manual_edit', 'merge', 'clinician_override'
- `source_note_id` (UUID) - References clinical_notes.id if from parsed note
- `created_by` (UUID) - References profiles.user_id
- `created_at` (TIMESTAMPTZ, Default: NOW())
- `changes_from_previous` (JSONB, Default: {}) - Diff from previous version
- `change_reason` (TEXT) - Explanation of changes
- `overall_confidence` (TEXT) - 'high', 'medium', 'low'
- `validation_status` (TEXT, Default: 'pending') - 'pending', 'validated', 'needs_correction'
- `validated_by` (UUID) - References profiles.user_id
- `validated_at` (TIMESTAMPTZ)

**Indexes:**
- `idx_profile_versions_user` - On (user_id, version_number DESC)
- `idx_profile_versions_active_unique` - Unique index on (user_id) WHERE is_active = true
- `idx_profile_versions_source` - On (source_note_id) WHERE source_note_id IS NOT NULL

**RLS Policies:**
- Users can view/insert their own versions
- Admins can view all versions

---

### profile_merge_conflicts

Tracks conflicts when new clinical notes disagree with existing profile.

**Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `user_id` (UUID, Required) - References profiles.user_id
- `existing_profile_version_id` (UUID) - References clinical_profile_versions.id
- `new_note_id` (UUID) - References clinical_notes.id
- `new_parsed_profile` (JSONB, Required) - The new profile from parsing
- `conflicts` (JSONB, Required) - Array of detected conflicts
- `resolution_status` (TEXT, Default: 'pending') - 'pending', 'auto_merged', 'manually_resolved', 'rejected'
- `resolved_by` (UUID) - References profiles.user_id
- `resolved_at` (TIMESTAMPTZ)
- `resolution_choice` (JSONB, Default: {}) - User decisions for each conflict
- `created_at` (TIMESTAMPTZ, Default: NOW())

**Indexes:**
- `idx_merge_conflicts_user` - On (user_id, created_at DESC)
- `idx_merge_conflicts_status` - On (user_id, resolution_status)

**RLS Policies:**
- Users can view/insert/update their own conflicts
- Admins can view all conflicts

---

## New Tables & Fields (Phase 1 - Week 3)

### probe_results Table

Stores results from generalization probe assessments. Probes use untrained words to measure true learning vs memorization.

**Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `user_id` (UUID, Required) - References auth.users, user who took the probe
- `session_id` (UUID, Nullable) - References sessions table
- `probe_word` (TEXT, Required) - The untrained word tested
- `target_difficulty` (INTEGER, Required) - Difficulty level 1-5
- `correct` (BOOLEAN, Required) - Whether answer was correct
- `error_type` (TEXT) - Classification of error (semantic_paraphasia, phonemic_paraphasia, etc.)
- `cues_needed` (INTEGER, Default: 0) - Number of cues required (0-2 for probes)
- `reaction_time_ms` (INTEGER) - Response time in milliseconds
- `created_at` (TIMESTAMPTZ, Default: NOW()) - When probe was administered

**Indexes:**
- `idx_probe_results_user_date` - On (user_id, created_at DESC) for efficient time-series queries
- `idx_probe_results_session` - On (session_id) for session-based analysis

**RLS Policies:**
- Users can only access their own probe results
- Admins can view all probe results for analytics

---

### exercise_events Enhancements

Added advanced error classification fields for rich analytics.

**New Columns:**
- `error_classification` (JSONB, Default: {}) - Full error analysis including:
  - `errorType`: Type of error (semantic_paraphasia, phonemic_paraphasia, neologism, etc.)
  - `confidence`: Classification confidence (0-1)
  - `reasoning`: Explanation of classification
  - `needs_review`: Whether manual review is needed
  
- `phonological_similarity` (NUMERIC(4,3)) - Phonological similarity score (0-1) between spoken word and target
- `semantic_similarity` (NUMERIC(4,3)) - Semantic similarity score (0-1) 
- `classification_confidence` (NUMERIC(4,3)) - Overall classifier confidence (0-1)
- `needs_review` (BOOLEAN, Default: false) - Flag for uncertain classifications

**Indexes:**
- `idx_exercise_events_needs_review` - Partial index on (user_id, needs_review) WHERE needs_review = true
- `idx_exercise_events_error_classification` - GIN index for JSONB error_classification queries

---

## Views

### probe_analytics View

Aggregated probe assessment analytics by user and date for dashboard visualization.

**Columns:**
- `user_id` - User identifier
- `assessment_date` - Date of assessment
- `total_probes` - Number of probe trials
- `correct_count` - Number correct
- `accuracy_pct` - Percentage accuracy (0-100)
- `avg_cues_needed` - Average cues per trial
- `avg_reaction_time_ms` - Average response time
- `avg_difficulty` - Average difficulty level
- `semantic_errors` - Count of semantic paraphasias
- `phonemic_errors` - Count of phonemic paraphasias
- `neologism_errors` - Count of neologisms
- `unrelated_errors` - Count of unrelated responses
- `no_response_count` - Count of no responses

**Security:** Uses security_invoker to inherit RLS from probe_results

---

## Functions

### get_active_clinical_profile(p_user_id UUID)

Returns the currently active clinical profile for a user from the version history.

**Returns:** JSONB containing the active profile data

**Example Usage:**
```sql
SELECT get_active_clinical_profile('user-uuid-here');
```

---

### create_profile_version(...)

Creates a new clinical profile version, deactivates the old version, and updates profiles table.

**Parameters:**
- `p_user_id` (UUID) - User ID
- `p_profile_data` (JSONB) - New profile data
- `p_source_type` (TEXT) - How this version was created
- `p_source_note_id` (UUID, optional) - Related clinical note ID
- `p_change_reason` (TEXT, optional) - Explanation of changes
- `p_created_by` (UUID, optional) - Who created this version

**Returns:** UUID of the new version

**Example Usage:**
```sql
SELECT create_profile_version(
  'user-uuid',
  '{"impairments": {...}}'::jsonb,
  'note_parsing',
  'note-uuid',
  'Parsed from CT scan'
);
```

---

### get_probe_progress(p_user_id UUID, p_days INTEGER DEFAULT 90)

Returns probe assessment progress over time for trend analysis and generalization tracking.

**Returns:**
- `assessment_date` (DATE) - Date of assessment
- `accuracy_pct` (NUMERIC) - Accuracy percentage
- `avg_cues_needed` (NUMERIC) - Average cues per trial
- `total_probes` (BIGINT) - Number of probes administered
- `difficulty_level` (NUMERIC) - Average difficulty

**Example Usage:**
```sql
SELECT * FROM get_probe_progress('user-uuid-here', 30); -- Last 30 days
```

---

## Data Flow

### Probe Assessment Flow
1. Exercise page checks if probe should run (session 1 or every 5-7 sessions)
2. GeneralizationProbe component administers 5 untrained words
3. Each response is classified by error classifier
4. Results stored in `probe_results` table
5. Regular exercise begins after probe completion

### Trial Telemetry Flow
1. PhotoNamingGame classifies each response using ML error classifier
2. Classification includes phonological/semantic similarity scores
3. useExerciseTelemetry logs trial to `exercise_events` with:
   - Basic trial data (correct, RT, cue level)
   - Advanced error classification (error type, similarities, confidence)
   - Task parameters (difficulty, round number, etc.)
4. Data available for real-time dashboards and offline analysis

---

## Analytics Queries

### Recent Probe Performance
```sql
SELECT 
  assessment_date,
  accuracy_pct,
  avg_cues_needed,
  total_probes
FROM probe_analytics
WHERE user_id = 'user-uuid'
  AND assessment_date > CURRENT_DATE - INTERVAL '30 days'
ORDER BY assessment_date DESC;
```

### Error Pattern Analysis
```sql
SELECT 
  error_type,
  COUNT(*) as occurrences,
  AVG(semantic_similarity) as avg_semantic_sim,
  AVG(phonological_similarity) as avg_phono_sim
FROM exercise_events
WHERE user_id = (SELECT user_id FROM sessions WHERE id = 'session-uuid')
  AND session_id = 'session-uuid'
  AND error_type IS NOT NULL
GROUP BY error_type
ORDER BY occurrences DESC;
```

### Trials Needing Review
```sql
SELECT 
  e.created_at,
  e.error_type,
  e.error_classification,
  e.classification_confidence
FROM exercise_events e
JOIN sessions s ON s.id = e.session_id
WHERE s.user_id = 'user-uuid'
  AND e.needs_review = true
ORDER BY e.created_at DESC
LIMIT 20;
```

---

## Migration Notes

- **Schema Version:** 1.0 (Week 3, Phase 1)
- **Breaking Changes:** None - all fields are additions
- **Type Regeneration:** After running migration, Supabase will regenerate TypeScript types
- **Temporary Workaround:** Code uses `(supabase as any)` cast for probe_results until types are available

---

## Security Considerations

1. **Row-Level Security:** All tables have RLS enabled
2. **User Isolation:** Users can only access their own data
3. **Admin Access:** Admins can view all data for analytics via has_role function
4. **Data Integrity:** Check constraints ensure valid ranges for scores/similarities
5. **Cascade Deletes:** User deletion cascades to probe_results and related data

---

## Performance Optimization

1. **Indexes:** Strategic indexes on user_id, created_at, and needs_review
2. **Partial Indexes:** Only index trials needing review (saves space)
3. **GIN Indexes:** Efficient JSONB querying for error_classification
4. **View Caching:** probe_analytics view can be materialized if needed
5. **Query Planning:** Use EXPLAIN ANALYZE for slow queries

---

## Future Enhancements (v2)

- Add word embedding vectors for true semantic similarity (pgvector extension)
- Materialized views for aggregated statistics
- Partition exercise_events by month for large datasets
- Add database functions for complex analytics queries
- Real-time subscriptions for live progress tracking
