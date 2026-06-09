# Intervention Exposure Snapshot — Specification (NOT IMPLEMENTED)

**Status:** SPEC ONLY. Do not implement during the freeze.
**Why it exists:** Preserve clinical context *as it was at the moment a therapy occurred*. This is the one piece of data that is **irrecoverable later** — everything else can be backfilled from existing tables once rows accrue.
**Author intent:** Build the analysis layer only when cohorts are statistically meaningful (hundreds per cluster). Today: 5 users → spec, don't build.

---

## 1. The problem this solves

Today a game exposure and its clinical context live in separate tables and the context **drifts over time**:

| Field | Where it lives now | Why it drifts |
|---|---|---|
| game played, dose, cues, difficulty | `sessions`, `exercise_events`, `adaptation_trial_logs` | stable |
| aphasia type, severity, chronicity, lesion | `profiles` (+ trigger-extracted tags), `clinical_profile_versions` | **re-extracted, re-diagnosed, recomputed (chronicity is a function of `now()`)** |
| probe / functional / mastery deltas | `probe_results`, `functional_checkins`, `user_skill_mastery` | stable, joinable later |

Two years from now you cannot reconstruct *"what was this patient's severity / chronicity / lesion interpretation **when** they played Photo Naming on 2026-06-09."* Chronicity literally changes daily; severity and lesion interpretation get revised. **That snapshot is lose-it-forever.**

The deltas (probe before/after, functional before/after) are **derivable later** by joining on time windows — so they are explicitly NOT part of the write-once snapshot. Only the *context-at-play-time* must be frozen.

---

## 2. Design principles (non-negotiable)

1. **Write-once.** One row per game exposure, inserted at session/exercise completion. Never updated, never read by the engine.
2. **Engine-invisible.** No hook, selector, or adaptation path ever reads this table. It is pure research exhaust (same posture as `shadow_events` / mastery shadow layer).
3. **Denormalized snapshot, not foreign keys.** Copy the clinical-context values *in*, do not reference rows that will change. Keep an `clinical_profile_version_id` pointer for provenance, but also copy the resolved values.
4. **Append-only, no PII beyond existing scoped IDs.** `user_id` + `profile_id` already gated by RLS elsewhere; reuse that posture.
5. **Deltas are computed downstream, not stored here.** Probe/functional/mastery change is reconstructed by analysts joining on `(profile_id, occurred_at)` windows.

---

## 3. Proposed shape (for the future migration — do NOT run yet)

```text
intervention_exposure                 -- write-once research snapshot
─────────────────────────────────────
id                  uuid pk
user_id             uuid              -- scoped by RLS like other user tables
profile_id          uuid
session_id          uuid             -- provenance back to sessions
occurred_at         timestamptz      -- when the exposure happened (NOT now() at analysis)

-- WHAT therapy happened (copied from session/exercise_events at write time)
exercise_slug       text             -- normalized slug
trials              integer
duration_sec        integer
mean_difficulty     numeric          -- difficulty/tier during this exposure
cue_levels_used     jsonb            -- distribution, e.g. {"0":12,"1":3,"2":1}
mastery_state_at_play jsonb          -- snapshot of clinical_progression_state for this slug

-- WHO they were AT THIS MOMENT (the irrecoverable part — copied, not referenced)
clinical_profile_version_id uuid     -- provenance pointer
aphasia_type        text             -- copied value at play-time
severity            text
chronicity_tag      text             -- frozen; do NOT recompute from stroke_date later
days_since_stroke   integer          -- frozen integer, computed once
laterality          text
primary_territory   text
stroke_mechanism_tag text
comorbidity_flags   jsonb            -- apraxia/dysarthria/cognitive flags as known then
age_band            text
primary_goal        text

-- bookkeeping
snapshot_version    text             -- e.g. 'v1' so schema evolution is traceable
created_at          timestamptz default now()
```

### Grants / RLS (when implemented)
Same pattern as other user-scoped research tables:
```sql
GRANT SELECT, INSERT ON public.intervention_exposure TO authenticated;  -- insert own only
GRANT ALL ON public.intervention_exposure TO service_role;
-- RLS: users insert/select their own rows; admins/assigned-clinicians read via is_assigned_clinician/has_role.
-- NO update, NO delete policy for authenticated (write-once).
```

---

## 4. Write point (when implemented)

A single fire-and-forget insert at session end (alongside the existing post-session tasks in `endSession` / mastery shadow flush). Mirror the `emitConversationTurnEvent` / `flushMasteryShadow` pattern: try/catch, console.warn on failure, never block the user flow.

The values are read **once, at write time**, from:
- `sessions` / `exercise_events` → what happened
- `get_active_clinical_profile(user_id)` + the trigger-extracted profile tags → who they were
- `clinical_progression_state` → mastery state for that slug

---

## 5. Downstream questions it eventually unlocks (NOT now)

Once cohorts are large enough (target: hundreds per cluster):

> Which interventions helped **moderate anomic aphasia, 12–24 months post-stroke, temporal lesions**?

Answered by: filter `intervention_exposure` on frozen context → join probe/functional deltas on `(profile_id, occurred_at)` windows → aggregate.

Also: cue-effectiveness-by-profile, recovery-path ordering, dose-by-profile, game→generalization correlation. **All gated on N, not engineering.**

---

## 6. The stimulus-metadata companion (separate, also deferred)

Independent but equally important confound-killer: tag each stimulus bank item with `frequency / syllables / phonological_complexity / semantic_category / imageability / age_of_acquisition / trained_vs_untrained`. Static content tagging, not runtime telemetry. Without it you cannot separate *"patient improved"* from *"item was easier."* Spec this separately when ready; it can be backfilled onto existing banks at any time (lower urgency than the context snapshot, which cannot).

---

## 7. Explicit DO-NOT list (this freeze)

- Do NOT create the table or migration.
- Do NOT add a write hook.
- Do NOT build lesion-response models, cohort recommenders, recovery prediction, or cross-user intelligence.
- Do NOT let any engine code import or read this concept.

**Trigger to revisit:** real probe / functional / mastery / retention rows are accumulating from real users, and at least one cluster approaches analyzable N.
```
