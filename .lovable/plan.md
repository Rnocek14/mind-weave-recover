

# Upgrade Session Cards: Rich Collapsed View + Comprehensive Data

## Problem
Collapsed session cards show only date, time, duration, and accuracy%. A clinician scrolling through sessions gets almost no information without clicking into each one. The data exists — it's just hidden.

## What the Collapsed Card Should Show

Each session card (without expanding) will display:

```text
┌─────────────────────────────────────────────────────────┐
│ Mon, Apr 7    10:32 AM                          ▼       │
│ ⏱ 8min  ·  🎯 67%  ·  18 trials  ·  3 exercises       │
│                                                         │
│ [Category Fluency 80%] [Photo Naming 45%] [Fix Sent 75%]│
│                                                         │
│ ⚡ 2 adaptations  ·  🎤 5 recordings  ·  Avg 2.3s      │
└─────────────────────────────────────────────────────────┘
```

Key additions to collapsed view:
- **Total trials count**
- **Number of exercises played** with exercise name pills showing per-exercise accuracy
- **Adaptation count** (if any occurred)
- **Audio recording count** (if any)
- **Average reaction time**
- **Mood rating** (if recorded)
- **Caregiver notes indicator** (if present)
- **Engagement flags** (if session had stalls/skips)

## How to Get This Data Without Extra Queries

The `sessions.summary` JSONB already contains `reps`, `scores` (per-exercise), and `durationSec`. We also need a lightweight pre-fetch of exercise event counts per session. Two approaches:

**Approach chosen**: Fetch a summary aggregate alongside sessions in the initial load — one additional query that groups `exercise_events` by `session_id` for all visible sessions. This gives us trial counts, exercise slugs, accuracy, audio counts, and avg reaction time for the collapsed view without needing to expand.

## Implementation

### File: `src/components/patient-hub/SessionsTab.tsx`

**1. Add pre-fetch of session-level exercise summaries** (~20 lines)
- After fetching sessions, batch-query `exercise_events` grouped by `session_id, exercise_slug` for all loaded session IDs
- Store as `Map<sessionId, ExerciseSummary[]>` with fields: slug, trialCount, accuracy, audioCount, avgRtMs
- Also batch-query `adaptation_events` count per session

**2. Redesign collapsed card header** (~60 lines rewrite of lines 216-231)
- Row 1: Date + time (keep) + expand chevron
- Row 2: Duration · Overall accuracy · Total trials · Exercise count
- Row 3: Exercise pills — each showing name + accuracy% with color coding
- Row 4 (conditional): Adaptation count badge, audio count, avg RT, mood emoji, caregiver note icon

**3. Keep expanded view as-is** — it already has the full drill-down

### No new files, hooks, or tables needed
- All data comes from `exercise_events` and `adaptation_events` (already queried elsewhere)
- Just a smarter initial fetch + richer card layout

## Technical Details

- Pre-fetch uses `exercise_events` grouped by session_id with counts — single query for all visible sessions
- Adaptation count uses `adaptation_events` count per session — single query
- Session `caregiver_notes` and `mood_rating` already fetched but not selected — add to the select clause
- Exercise pills use the same color scheme as expanded view (green ≥80%, yellow ≥50%, red <50%)

