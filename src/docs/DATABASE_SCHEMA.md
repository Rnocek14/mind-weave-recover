# Database Schema Documentation

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
