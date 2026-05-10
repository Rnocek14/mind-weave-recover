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
