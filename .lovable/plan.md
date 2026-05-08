# Runtime Integrity Repair Plan (revised, post-review)

Goal: restore the longitudinal write pipeline (mastery + progression authority)
without touching session-local adaptation, gameplay, or UI semantics.

Each phase is independently shippable and ends with a concrete verification
step. These bugs are silent by construction — never skip verification.

## Review revisions incorporated

1. **Phase 1 and Phase 4 ship as a single PR.** Shipping Phase 1 alone would
   instantly route every legacy slug (`two_clues`, `describe_guess`,
   `meaning_match`, `narrative_retell`, `multi_step_planning`, etc.) into
   expressive mastery — strictly worse than today's "0 rows" state for those
   games. The legacy `expressive` fallthrough in `routeTrialMode` is tightened
   to `skipped_unknown` in the same PR, so only allowlisted + tagged trials
   contribute.
2. **Phase 5 is re-scoped.** `sendBeacon` is dropped from the in-process
   logger (it can only POST to a URL, not call the JS client). Two explicit
   options documented; no implementation until a decision is made.
3. **Idempotency uses a real natural key** —
   `(session_id, exercise_slug, trial_index)` unique constraint with
   `onConflict` — not a client-generated UUID bolted on top of the existing PK.
4. **Phase 0 verification adds a `naming.unspecified` post-deploy check** to
   catch the `difficulty` column being NULL more often than expected.

---

## Phase 0 — Baseline Evidence (no code changes) — DONE

Captured before Phase 1 ships:

| Metric | Value | Notes |
|---|---|---|
| `user_skill_mastery` rows | **0** | Confirms mastery layer is dead |
| `skill_mastery_history` rows | **0** | Confirms longitudinal layer is dead |
| `adaptation_trial_logs` rows | 460 | Healthy write side |
| `adaptation_trial_logs` w/ NULL session_id | 16 | Pre-existing; pre-session-ready logger races. Not in scope here. |
| Slug forms in `adaptation_trial_logs` | All underscore | Confirms writer canonicalizes |
| Slugs with `trial_mode` populated | `photo_naming` only (91/107) | Confirms only PN is wired for trial-mode |
| `clinical_progression_state` rows | 1 (`photo-naming`) | Dash-form confirmed |

Post-Phase 1+4 verification reads (run within 24h of deploy):
1. `SELECT count(*), max(last_practiced_at) FROM user_skill_mastery;` — must be > 0.
2. `SELECT count(*) FROM skill_mastery_history;` — must be > 0 within 7 days.
3. **Naming bucket-degradation check:**
   ```sql
   SELECT skill_slug, count(*), max(last_practiced_at)
   FROM user_skill_mastery
   GROUP BY skill_slug ORDER BY 2 DESC;
   ```
   If `naming.unspecified` dominates, `adaptation_trial_logs.difficulty` is
   NULL more than expected and `classifyNamingByFrequency` is degrading.
   Separate problem; file ticket but do not block this rollout.
4. `SELECT exercise_slug, count(*) FILTER (WHERE n.skipped_unknown) FROM ...`
   via console — the `[Mastery] N trial(s) for adopted slug "X" had null/missing
   trial_mode` warning count should match Fix-Sentence trial volume (because
   Fix Sentence is allowlisted but not yet emitting `trial_mode`).

---

## Phase 1+4 (combined) — Slug Normalization + Adoption Tightening (one PR)

**Single shippable unit. Do not split.**

### Changes
1. `src/lib/mastery/skillMapping.ts`
   - Add `normalizeExerciseSlug(slug)` at the entry of `mapTrialToSkills`.
   - Convert all `switch` cases to canonical underscore form.
   - Convert `MASTERY_EXCLUDED_EXERCISES` to underscore form
     (`conversation_partner`, `conversation_coach`).
   - `isExcludedFromMastery` normalizes its input.
2. `src/lib/mastery/masterySignalRouting.ts`
   - Convert `ADOPTED_TRIAL_MODE_SLUGS` to underscore form.
   - Add `fix_sentence` to the allowlist
     (currently has 8 trials with NULL `trial_mode` → all will be
     `skipped_unknown` until the FixSentence game starts emitting tags;
     this is correct and intended).
   - Normalize slug at entry of `isAdoptedForTrialMode` and `routeTrialMode`.
   - **Tighten the legacy fallthrough**: non-adopted slugs return
     `skipped_unknown` (with no warning, since they aren't expected to be
     wired yet) instead of `expressive`. This prevents Phase 1 from silently
     enrolling every legacy game into expressive mastery.
3. `src/lib/mastery/contaminationAudit.ts`
   - Convert `QUARANTINED_SLUGS` to underscore.
   - Use `narrative_retell` for the sample mapping call.
4. **Delete** `src/hooks/useMasteryWriter.ts` (verified zero callers).
5. **Update** `src/lib/mastery/__tests__/*` to feed canonical underscore slugs.
6. **Add** a round-trip test (Phase 9 first deliverable, ships in this PR):
   `src/lib/mastery/__tests__/writerReaderRoundTrip.test.ts`
   - For each canonical adopted slug, build a `PendingRow`-shaped object
     identical to what `useAdaptationTrialLogger` produces, run through
     `routeTrialMode` + `mapTrialToSkills`, assert non-empty result.
   - Test must FAIL on main today, PASS after this PR.

### Behavioral outcome after this PR
- Photo Naming with `trial_mode='production'` → routes to expressive →
  `mapTrialToSkills('photo_naming')` → `naming.high-frequency` /
  `naming.low-frequency` / `naming.unspecified` row written.
- Fix Sentence with NULL `trial_mode` → `skipped_unknown` (warned).
  No mastery rows yet — wiring trial_mode emission is a separate, later task.
- All other games → `skipped_unknown` (silent). No mastery rows.
  This preserves the current "no contamination" property.

### Out of scope for this PR
- Wiring `trial_mode` emission for Fix Sentence (separate ticket).
- Migrating `clinical_progression_state.exercise_slug` form.
- Adopting any other slug into `ADOPTED_TRIAL_MODE_SLUGS`.

---

## Phase 2 — Surface Production Failures (parallel PR)

**Objective:** never again have a write path die silently in prod.

### Changes
1. `src/hooks/useAdaptationTrialLogger.ts`
   - Replace the dev-gated `console.warn` for insert errors with
     unconditional `console.error('[adaptation_trial_logs] insert failed', ...)`.
   - Add a counter ref tracking consecutive failed flushes; after 3
     consecutive failures, emit one `exercise_events` row with
     `event_type='telemetry_write_failure'` (debounced one-per-session).
2. `src/lib/mastery/flushMasteryShadow.ts`
   - Promote the silent `console.warn` in the catch block to `console.error` in prod.
   - Add `console.info('[mastery] flushed', { sessionId, skills })` on success.
   - Log when `skillList.length === 0` so the silent early-return becomes visible.

### Verification
- Force a failing insert in dev (RLS denial) and confirm both the console
  error AND the `exercise_events` failure row appear after 3 attempts.

---

## Phase 9 — Round-Trip Test Suite (parallel; first test ships with Phase 1+4)

### Tests
1. `writerReaderRoundTrip.test.ts` — ships in Phase 1+4.
2. `bridgeFloorRespected.test.ts` — ships with Phase 3.
3. CI gate: add to existing `vitest` run.

---

## SECOND WAVE (after Phase 1+4 numbers verified clean)

### Phase 3 — Fix the Progression Load Race

Wait at least 24h after Phase 1+4 deploy to confirm mastery rows appear for
sessions that started at level 1 (current default). Only then change which
level sessions start at.

#### Changes
1. `src/pages/PhotoNamingExercise.tsx` — gate render of `<PhotoNamingGame>`
   on `progression.loaded === true`. Reuse existing exercise loading skeleton.
2. `src/pages/FixSentenceExercise.tsx` — same pattern.
3. Dev-only log on first game mount: `[progression] mounted with floor=X, clinicalLevel=Y`.

#### Verification
- Seed `clinical_progression_state` for a test profile at `currentLevel=4`.
- Reload the Photo Naming exercise; confirm `useInGameAdaptation`'s starting
  `difficultyTier` equals the bridge floor (4), not 1.

### Phase 6 — DB Invariant + Slug Helper

Ships only after Phase 1+4 has been in prod for ≥7d with all-underscore writes.

#### Migration
1. `CHECK (exercise_slug ~ '^[a-z][a-z0-9_]*$')` on `adaptation_trial_logs.exercise_slug`.
2. `CHECK (exercise_slug ~ '^[a-z][a-z0-9-]*$')` on `clinical_progression_state.exercise_slug`.
3. **Replace UUID-based idempotency** (per review #3) with a unique constraint:
   `UNIQUE (session_id, exercise_slug, trial_index)` on `adaptation_trial_logs`.
   This is the natural key per logical trial. Inserts in Phase 5 use
   `onConflict: 'session_id,exercise_slug,trial_index'`.
4. Add `src/lib/exerciseSlugNormalizer.ts` helpers:
   - `toProgressionSlug(canonical)` — underscore → dash for `clinical_progression_state` reads/writes.
   - `fromProgressionSlug(progression)` — dash → underscore for cross-table joins.
   - Document in `src/docs/DATABASE_SCHEMA.md` that telemetry uses underscore,
     progression uses dash, and **all cross-table boundaries must normalize**.

#### Reason for the asymmetry
The progression table is internally symmetric (one hook reads & writes its
own slug). The real risk is *future* joins between
`clinical_progression_state` and `adaptation_trial_logs` (e.g., a clinician
view showing "level X, last N trials"). The helper centralizes the
conversion so a future grep for `toProgressionSlug` finds every cross-table
boundary in one search.

---

## Phase 5 — Tail-Loss Hardening (RE-SCOPED, requires explicit decision)

### Re-scope (per review #2)

The original plan claimed a one-line `sendBeacon` fix. That is wrong:
`sendBeacon` only POSTs to a URL — it cannot call the Supabase JS client.
The team must pick ONE of these before this phase ships:

#### Option A — Build a beacon endpoint (full work)
- New edge function `log-trial-beacon` that accepts a JSON beacon payload
  and inserts to `adaptation_trial_logs` server-side.
- Logger registers `pagehide` / `visibilitychange→hidden` handler that
  serializes the buffer and calls `navigator.sendBeacon('/functions/v1/log-trial-beacon', blob)`.
- Idempotency via the Phase 6 `(session_id, exercise_slug, trial_index)` constraint.
- Estimated: 1 dev-day. Adds a new auth surface to harden.

#### Option B — Accept iOS Safari tail loss, document it
- `pagehide` and `visibilitychange→hidden` trigger best-effort `flush()`
  using the existing client. Most browsers complete the in-flight fetch.
  iOS Safari may not.
- Document the loss boundary in `src/docs/DATABASE_SCHEMA.md` and
  `useAdaptationTrialLogger.ts` JSDoc.
- Revisit if longitudinal data quality complaints surface.

**Defer this phase until the team picks Option A or B.** Do not implement either silently.

### Items that ship regardless of A/B
- `useSessionLifecycle.ts` non-completed end paths (pagehide, visibility
  timeout) must `await flushAdaptationLogsRef.current?.()` before
  `endSessionWithReason`. Mirror the completed-session pattern.
- **Mastery flush on non-completed paths** (per the GPT critique): currently
  `flushMasteryShadow` only runs in the success branch of `sessions.update`.
  Move it so it also runs after timeout/abandonment, AFTER the trial flush
  has resolved. Otherwise abandoned sessions produce trial logs with no
  mastery aggregation — under-counting evidence for cognitively-fatigued
  users (a clinically sensitive subgroup).

---

## OUT OF SCOPE FOR THIS PUSH (held)

### Phase 7 — Minimal Pairs Progression
Defer until Phases 1+4, 2, 3, 6 are stable in prod. Requires a separate
decision: in-scope for v1 longitudinal model, or telemetry-only? Do not
start until that is answered.

### Phase 8 — Consume `consecutiveStruggleSessions` / `supportBaseline`
Requires team decision: Option A (consume them, make progression
runtime-authoritative) or Option B (stop writing them, mark v1 as "remembered
floor only"). Do not ship a clinical-level downward ceiling without this
decision — a floor that only goes up is clinically unsafe for a stroke
patient having a bad week.

---

## Execution Order

| Wave | Phases | Trigger to next wave |
|---|---|---|
| 1 | Phase 0 baseline (done) | — |
| 2 | Phase 1+4 merged (one PR) + Phase 2 (parallel) + Phase 9 round-trip test | 24h post-deploy: `user_skill_mastery` count > 0; no `naming.unspecified` dominance |
| 3 | Phase 3 (load race) + bridge test | Manual seed test passes |
| 4 | Phase 6 (DB constraint + helper) | 7d clean Phase 1+4 in prod |
| Held | Phase 5 (decision required), 7, 8 | Explicit team decision |

## Hard Constraints (unchanged)

- Do **not** modify `useInGameAdaptation` mid-session behavior.
- Do **not** migrate `clinical_progression_state.exercise_slug` form.
- Do **not** wire Minimal Pairs progression before Phase 6 ships.
- Do **not** introduce a clinical-level downward ceiling until Phase 8 is decided.
- Do **not** batch Phase 1+4 with Phase 3 or 5. Each later wave needs its own verification.

## Definition of Done (per wave)

**Wave 2:** `user_skill_mastery` row count > 0 within 24h. Round-trip test in CI is green. Telemetry insert failures visible in console + `exercise_events`.

**Wave 3:** Test profile at clinical level 4 starts every Photo Naming session at engine floor 4.

**Wave 4:** DB rejects dash-form slug inserts to `adaptation_trial_logs`. `(session_id, exercise_slug, trial_index)` unique constraint applied.
