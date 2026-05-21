# Unified Trial Submission — v1 (Step 1)

One canonical pathway every rehab game uses to record a trial.

## API

```ts
const { submitTrial, commitSession, startTrial, calculateReactionTime } =
  useTrialSubmission({ userId, profileId, sessionId, exerciseSlug, progression });
```

`submitTrial(input: UnifiedTrialInput)` fans out to:
1. `exercise_events`            (raw clinical record — via useExerciseTelemetry)
2. `adaptation_trial_logs`      (per-trial adaptation telemetry — opt-in via `taskParameters.unified_route_adaptation_log`; auto-wired games keep firing through useInGameAdaptation)
3. `clinical_progression_state` (buffered; flushed on commit)

`commitSession()` flushes:
- progression `flushAtSessionEnd` (per-game level/progress upsert)
- `flushMasteryShadow` (longitudinal `user_skill_mastery`)
- drains any queued adaptation rows

Pure types live in `src/lib/trial/types.ts`. No new promotion/regression behavior introduced — Step 2 will promote mastery confidence into the level-up evidence gate.

## Migration checklist

| Game | logTrial → submitTrial | progression buffer routed | commitSession wired | Notes |
|---|---|---|---|---|
| **Fix Sentence** (`pages/FixSentenceExercise.tsx`) | ✅ | ✅ via `useFixSentenceProgression` | ✅ replaces `flushAtSessionEnd` | full migration |
| **Minimal Pairs** (`pages/MinimalPairsExercise.tsx`) | ✅ | n/a (no progression hook yet) | ✅ (mastery flush only) | new progression hook = follow-up |
| **Photo Naming** (`pages/PhotoNamingExercise.tsx`) | ✅ (page-level call) | passed `progression: null` to avoid double-buffer (Game owns its own `usePhotoNamingProgression`) | inherited from Game's existing `flushAtSessionEnd` | partial — `PhotoNamingGame.tsx` keeps its 3 internal `progression.recordTrialOutcome` sites until the duplicate hook instance is consolidated |

## Console signal

In dev (or with `debug:true`), every trial logs:

```
[submitTrial] fan-out { game, level, isCorrect, supportUsed, stimulusId, routed:{exerciseEvents,adaptationTrialLogs,progressionBuffered}, progression:{level,progressPct,…} }
[commitSession] complete { game, sessionId, progression, masteryFlushed, errors }
```

Use these to verify all three systems updated from one call.

## Next steps (do NOT do here)

1. Promote mastery confidence into level-up `evidenceMet` (Step 2).
2. Wire fatigue → `support_baseline` bump.
3. Reinforcement scheduler.
4. Build Watch & Repeat on top.

---

## Step 2 — Mastery confidence gate (LANDED)

**File:** `src/lib/mastery/readMasteryGate.ts` + `applySessionToState` change.

The level-up rule in `applySessionToState` is now:

```
canLevelUp = progressPct >= 100
          && evidenceMet                 // accuracy + on-target support
          && masteryConfidence in {medium, high}   // longitudinal stability
```

`masteryConfidence` is the **minimum** confidence across every skill an
exercise trains (via `mapTrialToSkills`). If any skill row is missing — i.e.
the user hasn't accumulated enough longitudinal data for that skill yet —
the gate is treated as **undefined** and SKIPPED (backward-compatible). This
prevents new users from being trapped at Level 1 before the shadow flush
catches up.

### Wired callers

- `useFixSentenceProgression.flushAtSessionEnd` — reads gate before `applySessionToState`
- `usePhotoNamingProgression.flushAtSessionEnd` — same, with `difficulty` hint so naming.high vs naming.low-frequency picks the right skill bucket

### Debug

Both hooks now emit `masteryGate: { confidence, bySkill }` in their flush
diagnostic so you can see exactly which skill is holding the gate closed.
Look for the `masteryGateBlocked: true` flag in Photo Naming logs.

### NOT done in Step 2 (intentional)

- No reinforcement scheduler
- No fatigue → support baseline wiring
- No active mastery decay
- No hard regression / demotion
- No UI surfacing of mastery confidence

---

## Cross-game `cue_level` contract (LOCKED 2026-05-10)

`cue_level` (0..3) is the **clinician/system-issued cue intensity** dimension —
nothing else. It is the single signal mastery uses for cue independence:
`cue_independence = Σ(correct × (1 − cue_level/3)) / Σ(correct)`
(`src/lib/mastery/computeMastery.ts`). `compute-adaptation-profile` consumes
the same field for support-intensity trend. `detect-telemetry-anomalies` does
not read it.

| value | meaning |
|---|---|
| 0 | independent — no cue |
| 1 | semantic cue (category / function / first-letter) |
| 2 | phonemic cue (initial sound, syllable count) |
| 3 | full word / model |

### Per-game emission

| Game | cue_level source | Notes |
|---|---|---|
| **Photo Naming** | live cue ladder in `PhotoNamingGame` (`useState(0)` → `1` semantic → `2` phonemic → `3` full) | Only game emitting non-zero today. Mapped to `supportUsed` via `mapPhotoNamingSupport`. |
| **Fix Sentence** | always `0` | No in-trial cue ladder; difficulty carries the support story. |
| **Minimal Pairs** | always `0` | Replay scaffolding is **not** a cue — it lives entirely in `supportUsed` (`first_listen` vs `after_replay`) and `taskParameters.audio_replay_count`. Folding replays into `cue_level` would inflate "support intensity" trends and corrupt cue-independence math. |

### Rule for new games

If you add a game, set `cue_level: 0` unless you have a real
clinician/system-issued cue ladder (semantic → phonemic → full). Listen-again,
re-read, slower-pace, hint-tile-shown are **support tiers**, not cue intensity
— route them through `supportUsed`. Locked by
`src/lib/trial/__tests__/cueLevelContract.test.ts`.

---

## Step 3 — Five clinical axes (Phase 1, doc only)

Every rehab game in this codebase targets exactly **one** of five clinical
axes. The axis decides how `supportUsed` (the `SupportLevel` field of every
`UnifiedTrialInput`) is mapped from in-game scaffolding, and which engine
shape — pass/fail vs continuous — the game must use.

This is the contract a new `*Exercise.tsx` must satisfy before
`scripts/validateTelemetryCoverage.ts` will mark it as Tier-A/B-shaped.

| Axis | Mastery signal | Example games | Engine shape |
|---|---|---|---|
| **lexical** | pass/fail per trial | Photo Naming, Two Clues, Describe & Guess, Synonym Generator, Semantic Feature | trial-based + `usePhotoNamingProgression`-shaped hook |
| **comprehension** | pass/fail per trial | Meaning Match, Yes/No, Auditory Comprehension | trial-based |
| **discourse** | **continuous** `accuracyScore ∈ [0,1]` | Narrative Retell, Category Fluency, Conversation Coach, Thought Continuation | continuous-mastery contract (Phase 3) |
| **executive** | pass/fail or graded per trial | Detective Mind, Multi-Step Plan, Pattern Match, Abstract Compare | trial-based |
| **acoustic** | pass/fail per trial | Minimal Pairs, Phonological Awareness, Dual-Load Naming | trial-based + replay-aware `supportUsed` |

### Per-axis `supportUsed` mapping rule

`supportUsed` must be derived from **observed in-trial scaffolding**, never
inferred from difficulty level. Same rule as cue_level:0-vs-supportUsed in
Step 2 — replays, slower pace, hint-tile-shown, partner-modelled, all live
in `supportUsed`, not `cue_level`.

| Axis | `supportUsed: 'independent'` | `'support_minimal'` | `'support_moderate'` | `'support_max'` |
|---|---|---|---|---|
| **lexical** | named without any cue | semantic cue used (category / function / first letter) | phonemic cue used (initial sound, syllable count) | full word / model spoken |
| **comprehension** | answered on first read | re-read or re-listened once | re-read ≥2× / sentence simplified | full answer modelled or pointed-to |
| **discourse** | n/a — use `accuracyScore` instead | nudge / prompt repeated | narrowing hint shown (`narrowingLevel ≥ 1`) | full prompt restated or example given |
| **executive** | solved without intervention | hint highlighted | step revealed / sub-goal given | full plan shown |
| **acoustic** | `first_listen` correct | `after_replay` (≤2 replays) | `after_replay` (3–4 replays) | `audio_replay_count ≥ 5` or pair revealed |

**Discourse special case.** Discourse games MUST NOT collapse a graded
score into a pass/fail and emit `supportUsed`. Per the Progression Theory
Layer (v0.3.0-spec) `MasterySignalGranularity: 'continuous'`, these games
emit `accuracyScore` only and rely on the continuous-mastery contract
landing in Phase 3. Until that lands, discourse games run in **shadow** for
progression and continue to update `adaptation_trial_logs` for telemetry.

### Acceptance signature (used by the validator)

A `*Exercise.tsx` page is considered Tier-A/B-shaped when it imports either:

- `useStandardExerciseFlow` (the bundle from this hook), OR
- `useTrialSubmission` + `useInGameAdaptation` directly (legacy Tier-A
  shape — PhotoNaming / FixSentence / MinimalPairs).

Discourse pages additionally need either `useDiscourseAdaptation` or
`useDiscourseSignalScorer` since the standard trial-based adaptation
controller does not apply.

`scripts/validateTelemetryCoverage.ts` enforces this statically (no runtime
data required), so newly-added games fail CI until they are wired.
