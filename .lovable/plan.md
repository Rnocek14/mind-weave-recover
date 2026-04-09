

# P0 Restoration Plan: Complete the Patient Hub

## What's Missing (confirmed by audit)

### Sessions Tab
1. **No per-exercise drill-down** — exercises show as flat rows with no expandable trial detail
2. **No accuracy sparkline** — the `AccuracySparkline` component exists but isn't used
3. **No session plan reasoning** — `WhyThisPlan` component exists but isn't wired
4. **Audio is flat list** — not grouped by exercise, no best/worst curation
5. **No error type breakdown per exercise** — data exists in `exerciseBreakdown.errorTypes` but isn't rendered
6. **No difficulty progression** — adaptation events have `value_before`/`value_after` but aren't shown

### Patient Info Tab
1. **No alerts section** — `RecoveryAlertsPanel` exists with acknowledge/resolve actions but isn't imported
2. **No red flags** — `useRedFlagDetection` hook exists but isn't used

### Speech Profile Tab
1. **No trend charts** — only numbers/badges, no visual mini charts
2. **No challenging categories** — `most_challenging_categories` exists in speech profile but not rendered
3. **No profile freshness + recompute button** — `recomputeSpeechProfileNow` + `evaluateProfileFreshness` exist but not used
4. **No adaptation coverage map** — adaptation data exists but not shown per-exercise
5. **No evidence/confidence section** — GOP data counts, phoneme tokens, etc. exist in profile

### Intelligence Tab
1. **No longitudinal utterance comparison** — `LongitudinalUtteranceComparison` component exists but not imported
2. **No dose compliance** — `useDoseTargets` hook exists but not used

---

## Implementation Plan

### 1. Sessions Tab — Major upgrade (~200 lines added)

**File: `src/components/patient-hub/SessionsTab.tsx`**

- Add `AccuracySparkline` at top of tab using timeline data from `useWeeklyRecoverySnapshot`
- Make each exercise row in session cards **expandable** to show:
  - Every trial: target word, transcript/response, correct/incorrect badge, error type, cue given + effective badge, latency, audio play button
  - Error type distribution as small colored badges
  - Difficulty start → end (from adaptation events `value_before`/`value_after`)
- Group audio by exercise (not flat list)
- Add "Best" / "Worst" audio labels (highest/lowest score trials with audio)
- Add session plan reasoning section using `sessions.plan` JSONB field (collapsible)
- Fetch `sessions.plan` in the query (already selected but not used)

### 2. Patient Info Tab — Add alerts + red flags (~80 lines added)

**File: `src/components/patient-hub/PatientInfoTab.tsx`**

- Import `useRecoveryAlerts` and `RecoveryAlertsPanel` — render with acknowledge/resolve actions
- Import `useRedFlagDetection` — render red flags as warning cards
- Need to pass `timeline` from parent or fetch independently; simplest: use `useRecoveryAlerts` with minimal timeline fetch

### 3. Speech Profile Tab — Add charts, categories, freshness, evidence (~150 lines added)

**File: `src/components/patient-hub/SpeechProfileTab.tsx`**

- Add **Challenging Categories** card from `speechProfile.most_challenging_categories`
- Add **Profile Freshness** badge + **Recompute** button using `evaluateProfileFreshness` + `recomputeSpeechProfileNow`
- Add **Evidence/Confidence** section showing: trial count, GOP data count, phoneme tokens, confidence level
- Add mini trend indicators using recovery score snapshots (fetch last 4 snapshots for sparkline-style display)
- Add **Best Cue Type** callout — highlight the cue type with highest success rate

### 4. Intelligence Tab — Add utterance comparison + dose compliance (~60 lines added)

**File: `src/components/patient-hub/IntelligenceTab.tsx`**

- Import and render `LongitudinalUtteranceComparison` with recordings from `useWeeklySessionTimeline`
- Import `useDoseTargets` and render dose compliance section (prescribed vs actual)

### 5. PatientHub.tsx — Pass additional data to tabs

- Pass `timeline` to PatientInfoTab for alerts
- Pass `recordings` to IntelligenceTab for utterance comparison

---

## Technical Details

- **No new tables or migrations** — all data already exists
- **Reuses existing components**: `AccuracySparkline`, `RecoveryAlertsPanel`, `LongitudinalUtteranceComparison`
- **Reuses existing hooks**: `useRedFlagDetection`, `useDoseTargets`, `useRecoveryAlerts`
- **Reuses existing utilities**: `recomputeSpeechProfileNow`, `evaluateProfileFreshness`
- Estimated ~500 lines of changes across 5 files

