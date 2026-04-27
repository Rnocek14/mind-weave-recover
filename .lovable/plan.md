## What's already built (the honest re-audit)

Before writing new systems, here's what already exists in your codebase that the prompt assumes is missing:

| Phase 2 ask | Reality |
|---|---|
| Engagement detection (frustration, fatigue, hesitation) | **Built** — `src/lib/engagementMonitor.ts` (326 lines) computes streaks, RT spikes, timeout rate, cue dependency, hesitations, and recommends `continue / difficulty_down / break_prompt / confidence_boost / session_end`. |
| Hook to consume it | **Built** — `useEngagementMonitor` writes interventions to the `engagement_interventions` table. |
| Currently wired into | **Only `Exercise.tsx` and `useCoachSession`.** Photo Naming, Story Retell, Category Fluency, etc. do NOT call it. |
| Cross-game user error profile | **Built** — `useUserSpeechProfile` + `cueSelector.ts` already classify dominant error type and recommend cue type per user. |
| Cue dependency metric | **Built** — `useCueIndependence` computes `1 − weighted_avg_cue / max_cue` from `exercise_events.cue_level`. |
| Longitudinal learning rate | **Built** — `learning_rates` table + `calculate-learning-rates` edge function compute accuracy/RT slope per domain. |
| Cognitive state engine | **Built** — `cognitiveStateEngine.ts` (551 lines) feeds dashboard cards. |
| Therapeutic response ladder | **Built** — `therapeuticResponseLadder.ts` exists, only used by Smart Coach. |
| Plateau detection | **Partially built** — `learning_rates` has slope, but no flagging. |

So the real Phase 2 problem is **integration and visibility**, not invention. Five engines exist; nothing pulls them together into a single per-user adaptation profile that every game reads from and writes to.

---

## Plan — Phase 2: Adaptive Therapy Intelligence (integration layer, not rebuild)

### 1. `user_adaptation_profile` — the single source of truth
New table `user_adaptation_profiles` (one row per profile, updated nightly + on session end):

```text
profile_id, user_id
dominant_error_type           — semantic | phonemic | no_response | mixed
error_type_distribution        — jsonb { semantic: 0.4, phonemic: 0.35, no_response: 0.25 }
recommended_cue_bias           — semantic | phonemic | mixed
cue_dependency_score           — 0..1, weighted across last 14 days
cue_dependency_trend           — 'fading' | 'stable' | 'increasing'
avg_response_latency_ms        — rolling 30 trials
latency_trend_pct              — % change vs. prior window
engagement_baseline            — typical streak/timeout pattern
plateau_flag                   — true if 7+ days no learning_rate gain
last_computed_at, version
```

Backed by edge function `compute-adaptation-profile` (extends existing `calculate-learning-rates`). RLS: own-profile read, system write. Read-only at the game layer — games never mutate it directly.

### 2. Wire `useEngagementMonitor` into every adaptive game
The hook exists; games just don't call it. Add a one-line `engagement.recordTrial(...)` next to every existing `recordTrial` in Photo Naming, Semantic Feature, Category Fluency, Describe & Guess, Two Clues, Fix Sentence, Synonym, Narrative Retell, Multi-Step Planning, Detective Mind. Connect its output to:
- `useInGameAdaptation.stepDown()` when frustrated
- a non-blocking break prompt when fatigued
- a "let's try something easier" mid-session pivot when `session_end` is recommended

### 3. Cross-game profile read at exercise mount
Extend `useSessionAdaptation` (already the unified contract) to also pull from `user_adaptation_profiles`:
- Bias `recommendedCueType` toward `dominant_error_type` even when the current trial has no error history.
- Apply `cue_dependency_trend === 'fading'` → start one cue level lower than usual (cue fading).
- Apply `plateau_flag === true` → introduce novelty (rotate to a less-played exercise variant).

This means **every game** automatically inherits cross-game intelligence with zero per-game code changes beyond what's already wired.

### 4. Cue dependency safety gate (the most important rule)
Modify `useInGameAdaptation` to refuse difficulty escalation when:
```
cue_dependency_score > 0.5  AND  trials_at_current_level < 8
```
Instead, hold the level and reduce cue level for the next N trials. This implements the "80% with cues ≠ 80% independently" principle directly in the engine. Logs reason as `held_for_cue_fade` to `adaptation_events`.

### 5. Maya explanation copy for adaptation events
Add a small `adaptationNarrator.ts` that converts `adaptation_events` into one-sentence patient-facing copy. Maya speaks it in Full Coaching mode, displays it as a quiet badge in Guided mode, suppresses it in Games Only.

```text
direction:up, reason:fast_correct        → "You're getting these quickly — let's try a harder one."
direction:down, reason:frustration       → "That one was tough. Here's a little more support."
direction:hold, reason:cue_fade          → "You're doing well with hints. Let's try with fewer this time."
direction:none, reason:plateau_novelty   → "Let's try a different way to practice this."
```

### 6. Clinician telemetry — "Why it adapted" panel
On Patient Hub → Intelligence tab, add an "Adaptation Profile" card:
- Dominant error type + distribution sparkline (30 days)
- Cue dependency score + trend arrow
- Latency trend
- Plateau alert badge
- Last 5 adaptation events with human-readable reasons
- Recommended next focus (string from `strategy recommendation` rules below)

All driven from the new `user_adaptation_profiles` row + a live SQL view over `adaptation_events`. No new snapshots — same pattern as the Trend UI we shipped.

### 7. Strategy recommendation engine (deterministic rules first, no LLM)
New `src/lib/strategyRecommender.ts` — pure function that takes the adaptation profile and returns one of:
```text
- "Cue fading" — high accuracy + high cue dependency
- "Phonological production support" — phonemic errors dominant + rising
- "Semantic enrichment" — semantic errors dominant
- "Memory + sequencing scaffold" — story retell weak after 2min
- "Increase challenge" — fast accuracy + low cue use + stable
- "Reduce load + rest" — fatigue/frustration patterns sustained
```
Surfaces in the clinician card (#6) and feeds the daily lesson generator as a soft bias.

### 8. Documentation
Update `EXERCISE_ADAPTATION_GUIDE.md` with a new "Layer 3: Cross-Game Intelligence" section. Add a memory `mem://architecture/adaptation-intelligence-layer`.

---

## Explicitly out of scope

- No changes to the per-trial difficulty engine (`useInGameAdaptation` core loop is correct).
- No new ML — strategy recommender is rules-based and auditable.
- No new snapshot/cron tables for telemetry — live views, same as the Trend UI decision.
- No rebuild of `engagementMonitor.ts`, `cognitiveStateEngine.ts`, or `cueSelector.ts` — they're solid, just under-consumed.

## Order of implementation

1. `user_adaptation_profiles` table + `compute-adaptation-profile` edge function
2. Wire `useEngagementMonitor` into the 10 adaptive games (mechanical pass)
3. Extend `useSessionAdaptation` to read the profile
4. Cue dependency safety gate in `useInGameAdaptation`
5. `strategyRecommender.ts` + clinician card
6. `adaptationNarrator.ts` + Maya copy
7. Docs + memory

## Files touched

- `supabase/migrations/<new>.sql` — `user_adaptation_profiles` table, RLS, view `v_adaptation_event_summary`
- `supabase/functions/compute-adaptation-profile/index.ts` — new
- `src/hooks/useSessionAdaptation.ts` — read profile
- `src/hooks/useInGameAdaptation.ts` — cue-dependency gate
- `src/lib/strategyRecommender.ts` — new
- `src/lib/adaptationNarrator.ts` — new
- 10 game components — add `engagement.recordTrial(...)` line
- `src/components/patient-hub/AdaptationProfileCard.tsx` — new
- `src/pages/PatientHub.tsx` — mount card on Intelligence tab
- `src/docs/EXERCISE_ADAPTATION_GUIDE.md` — update
- `mem://architecture/adaptation-intelligence-layer` — new memory

Approve and I'll implement in the order above. Phase 1 (the prior plan) does not need to ship first — these are independent and can land in parallel, but I'll do Phase 1 first since you already approved it.