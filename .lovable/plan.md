## Goal

Add a **Session Review** experience inside Clinical Detail that gives SLPs the recording-level evidence they actually use clinically — without cluttering the top Glance cards.

## My analysis of your spec

Your 5 sections are exactly right. After auditing the codebase + clinical literature (WAB, Boston Naming Test scoring, PACE therapy), I'd add 3 things and flag 2 limits:

**Strong additions worth including:**

1. **Cue-fade trajectory across sessions** — not just "X correct after phonemic cue this session," but "phonemic-cue dependency dropped from 60% → 35% over 4 weeks." This is the single most-cited evidence of true recovery vs. compensation. We already log `cue_type_given` + `cue_was_effective`, so it's free.
2. **Latency / response time per error type** — slow-but-correct vs. fast-and-wrong have totally different clinical meanings. SLPs use this to distinguish word-finding deficit from semantic loss. We already capture `reaction_time_ms`.
3. **Self-correction tracking** — patient said "duh… dog!" — clinically huge (intact monitoring) and we already classify `self_corrected`.

**Two honest limits to flag in the UI rather than fake:**

- **Phoneme-level errors** (final /t/, /r/-/l/ confusion): we have `phonological_similarity` (Levenshtein) and Azure pronunciation scores when present, but no true phoneme-substitution log. We can derive *approximate* sound-pattern hints by diffing transcript vs. target on the consonant level — useful as a hypothesis, not a diagnosis. Label it "Sound patterns to investigate" not "Phoneme errors."
- **Perseveration** requires looking across trials within a session (same wrong answer reused). Doable — we have ordered trials — but should be derived, not assumed in the schema.

## What I'll build

A new **`SessionReviewTab`** added as a 5th tab inside the existing Clinical Detail drawer (next to Sessions / Speech / Patient / Intel). Selecting a session opens a focused review panel with 5 stacked sections. Mobile-first, single column, evidence-first.

```text
Clinical Detail (drawer)
└── Tabs: Sessions | Review | Speech | Patient | Intel
                    ▲ NEW
    └── Session picker (last 10 sessions, dated)
        └── 1. Session Summary strip
            2. Voice Evidence (4 clips)
            3. Error Pattern Breakdown
            4. Sounds to Watch (derived, hedged)
            5. Cue Response + cross-session fade chart
            6. Clinician Notes (existing component, embedded)
```

## Section-by-section build

### 1. Session Summary strip
One row, six chips: date · duration · games played · accuracy · highest level reached · cue dependency %. Pulls from `sessions` + `useSessionDetail` (already exists).

### 2. Voice Evidence — 4 curated clips
Reuses the same audio playback + signing pattern as `useSessionDetail.playAudio`. Quality filter (≥400ms, non-empty transcript) already established in caregiver `ListenCard`.

- **Best response** — highest score, fastest RT, no cue
- **Representative error** — most-frequent error type this session
- **Hardest successful** — highest difficulty level where they got it right (with or without cue)
- **Most recent attempt** — last trial chronologically

Each clip card shows: ▶ play · target word · transcript · error type chip · cue chip · RT.

### 3. Error Pattern Breakdown
Horizontal bar chart, counts + %, derived from `error_type` column on `exercise_events` / `utterance_analyses`:
- phonemic paraphasia · semantic paraphasia · circumlocution · self-corrected · no response · neologism · perseveration (derived: same wrong answer ≥2 trials) · agrammatic (derived from word count + target type for sentence tasks)

Click any bar → filters the trial list below to just those trials with their audio.

### 4. Sounds to Watch (hedged)
Computed client-side from incorrect trials only. For each (target, transcript) pair we diff the consonant skeleton and surface the top 3 recurring patterns, e.g. "Final /t/ dropped 4× · /r/ → /w/ 3× · /s/-blend reduced 2×". Header reads **"Patterns to investigate (auto-detected — confirm clinically)"** so SLPs know it's a hypothesis. If we have <5 incorrect trials with audio, hide the section instead of showing noise.

### 5. Cue Response + Fade Trajectory
Two parts:
- **This session**: stacked bar — correct without cue / correct after semantic / correct after phonemic / correct after repetition / still incorrect. Pulls `cue_type_given` + `cue_was_effective`.
- **Across last 8 sessions**: small line chart of "% trials needing any cue." This is the recovery signal SLPs care most about — cue dependency dropping = real generalization.

### 6. Clinician Notes
Embed existing per-session note input from `clinician_session_notes` table (already has RLS for assigned clinicians). Shows prior notes for this session, allows new note. No new table.

## Files

**New:**
- `src/components/patient-hub/SessionReviewTab.tsx` — the tab container + session picker
- `src/components/patient-hub/review/SessionSummaryStrip.tsx`
- `src/components/patient-hub/review/VoiceEvidenceGrid.tsx` — 4 clip cards + audio
- `src/components/patient-hub/review/ErrorPatternBreakdown.tsx` — bar chart + filter
- `src/components/patient-hub/review/SoundsToWatch.tsx` — consonant-diff heuristic
- `src/components/patient-hub/review/CueResponsePanel.tsx` — this-session + fade chart
- `src/components/patient-hub/review/SessionNotesPanel.tsx` — wraps `clinician_session_notes`
- `src/lib/clinical/derivePerseveration.ts` — pure helper, scans trial sequence
- `src/lib/clinical/deriveSoundPatterns.ts` — pure helper, consonant-level diff

**Edited:**
- `src/pages/PatientHub.tsx` — add 5th tab `<TabsTrigger value="review">Review</TabsTrigger>` and `<TabsContent>`. Grid changes from `grid-cols-4` → `grid-cols-5`.

**Reused (no edits):** `useSessionDetail`, `useSessionSummary`, `useClinicalNotes`, `AccuracySparkline`, audio storage signing.

## Constraints I'll respect

- No new tables, no migrations — every signal already exists in `exercise_events` / `utterance_analyses` / `clinician_session_notes`.
- No changes to top Glance cards.
- Sounds-to-Watch is clearly labeled as auto-derived hypothesis, hidden when data is too thin.
- Mobile-first single column; clip cards stack on narrow viewports.
- Performance: only fetch trials for the *selected* session (lazy), not all sessions.

## What I'm explicitly NOT adding

- True phoneme-level ASR alignment (would need server-side Montreal Forced Aligner or equivalent — out of scope, and would mislead if half-built).
- New tabs or sections in the top Glance row.
- Cross-patient comparisons (lives in cohort analytics, separate page).

## Open question for you

For **Voice Evidence**, I picked Best / Representative Error / Hardest Successful / Most Recent. You also mentioned "before/after comparison" and "repeated target attempts over time." Those are powerful but cross-session — they'd live better as a **second view inside Voice Evidence**: a toggle "This session / Same target across time" that, when a target word is selected, pulls every attempt of that word from the last N sessions. Want me to include that toggle in v1, or ship the 4-clip view first and add it next?