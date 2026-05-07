# Progression Gating — Design Spec (v0.1, read-only)

**Status:** SPEC ONLY. No runtime imports. No enforcement. No UI surface.
**Owner:** progression theory layer.
**Source of truth for rules:** `docs/telemetry-validation-checklist.md`.
**Source of truth for anomalies:** `adaptation_trial_log_anomalies` (read-only).
**Linked spec:** `src/lib/leveling/progressionArchetypes.ts` (frozen v0.3.0-spec).

This document defines **how anomalies should eventually be allowed to
suppress, delay, or annotate progression signals** — once the observability
layer (dashboard, drill-down, share) has demonstrated rule stability.

Nothing here is wired. This is the contract that future code will implement
against, so reviewers can argue with the policy before it ships.

---

## 1. Why a gating layer at all

The platform now produces three independent streams:

1. **Adaptation telemetry** — per-trial logs (`adaptation_trial_logs`).
2. **Anomaly stream** — semantic violations of the validation checklist
   (`adaptation_trial_log_anomalies`).
3. **Progression signals** — mastery shadow writes, level changes,
   visible progress, scaffold withdrawal decisions.

Without a gate, progression consumes telemetry **uncritically**. That
creates two clinical risks:

- **Inflated mastery**: a session dominated by recognition / scaffolded
  trials can lift mastery the same as a production-heavy session.
- **Premature withdrawal**: scaffold removal triggered by accuracy that
  was structurally inflated (D2/D3) or label-corrupted (S6–S8).

A gate is the architectural mechanism that says: *"this telemetry is
trustworthy enough to update progression."*

---

## 2. Non-goals (explicit)

The gate is NOT:

- A second rules engine. It only **consumes** the checklist.
- A UI feature. Patients and caregivers must not see "blocked" states.
- A retroactive eraser. It never deletes data; it only filters at
  consumption time.
- A clinician override system. Overrides are a separate later phase.
- A scoring penalty. It does not change scores; it changes whether
  scores propagate.

---

## 3. Surfaces the gate eventually controls

| Surface | What the gate decides | Default behavior today |
|---|---|---|
| **Mastery shadow writes** (`flushMasteryShadow`) | whether a trial contributes to skill mastery deltas | always writes |
| **Level progression** (in-game UP path: `useInGameAdaptation.recordTrial`) | whether an UP escalation is allowed | already gated by cue-dependency safety gate; new rules layer on top |
| **Visible progress UI** (Glance Cards: Progress, Levels) | whether displayed progress reflects this session | always reflects |
| **Scaffold withdrawal** (per-slug scaffold_level decreases) | whether withdrawal is permitted | always permitted |
| **Live progression rollout** (future) | whether longitudinal mastery becomes user-visible | not rolled out |

Every surface MUST read its decision from a single function in a future
`src/lib/progression/gate.ts`. Surfaces never re-derive gating logic.

---

## 4. Anomaly → progression effect mapping (proposed)

This is the policy table. Every rule in
`docs/telemetry-validation-checklist.md` gets an explicit progression
verdict. New rules must add a row here before being enabled in the gate.

Verdicts:

- **drop** — the trial does not contribute to mastery, level deltas, or
  scaffold withdrawal. Still logged, still visible in dashboards.
- **delay** — contribution deferred until N additional clean trials at
  the same level / mode confirm the signal.
- **annotate** — contribution allowed, but tagged with
  `gate_reason = <rule_id>` so downstream consumers (mastery, scaffold)
  can choose to discount.
- **pass** — no progression effect.

| Rule | Severity | Verdict | Rationale |
|---|---|---|---|
| S1–S5 | error | drop | Schema invariants. Trial is malformed; cannot be trusted for any purpose. |
| S6 | error | drop | Boolean granularity carrying graded fields = corrupt label. |
| S7 | error | drop | Graded granularity missing graded_score = unscoreable. |
| S8 | error | drop | Multi-dim missing score_vector = unscoreable. |
| S10 | warn | annotate | Granular fields without archetype/axis — usable but un-routable to the right mastery axis. |
| C1 | warn | delay (1 trial) | production+correct with empty response_text — likely ASR misroute. Hold until next clean production trial confirms. |
| C3 | warn | annotate | Scaffolded trial with no scaffold signal — count toward mastery but do NOT count toward scaffold withdrawal evidence. |
| C4 | warn | drop | Exposure trials must never be judged. |
| C6 | warn | annotate | Archetype/axis mismatch — route to mastery using declared axis only. |
| C7 | warn | annotate | Same as C6 for performance-pressure. |
| C8 | warn | annotate | Open-ended with boolean granularity — usable but signal is weak; mastery delta clamped to ≤0.5×. |
| D1 | warn | block UP escalation for session | Production share too low — session not representative enough to escalate. |
| D2 | warn | block UP escalation + block scaffold withdrawal for session | Recognition inflation directly threatens both. |
| D3 | warn | block scaffold withdrawal for session | Scaffold inflation specifically corrupts the withdrawal signal. |
| D4 | error | drop session from mastery | Logger gap — entire session is interpretively suspect for the affected slug. |
| D5 | info | annotate | Reversed recognition vs production — surface to clinician later, no automatic action. |
| D6 | info | annotate | Reversed scaffold vs production — same as D5. |
| D7 | warn | delay UP escalation by one session | 100% production over ≥10 trials — likely mislabel; require a second confirming session before escalating. |
| D8 | warn | block scaffold withdrawal cross-session | Scaffold creep — must resolve before withdrawal allowed. |
| D9 | warn | block scaffold withdrawal cross-session | Withdrawal regression pattern. |

**Severity is informational; verdict is normative.** Two rules at the
same severity can carry different verdicts because they affect different
surfaces.

---

## 5. Gate function shape (future)

```ts
// src/lib/progression/gate.ts  (NOT YET CREATED)

export type GateSurface =
  | "mastery_write"
  | "level_up"
  | "scaffold_withdraw"
  | "visible_progress";

export type GateVerdict =
  | { kind: "pass" }
  | { kind: "drop"; rule_id: string }
  | { kind: "delay"; rule_id: string; trials_required: number }
  | { kind: "annotate"; rule_id: string; weight?: number };

export interface GateInput {
  surface: GateSurface;
  trial: AdaptationTrialLog;            // single trial in question
  sessionAnomalies: Anomaly[];          // session-scope anomalies
  trialAnomalies: Anomaly[];            // anomalies pinned to this trial
  recentCleanTrials: number;            // for delay verdicts
}

export function evaluateGate(input: GateInput): GateVerdict;
```

Properties the implementation MUST satisfy (will become tests):

1. **Pure.** No I/O, no clocks, no Supabase. Same input → same verdict.
2. **Surface-aware.** Same anomaly set can produce different verdicts
   for `mastery_write` vs `scaffold_withdraw` (e.g. C3).
3. **Strictest-wins ordering.** When multiple verdicts apply:
   `drop > delay > annotate > pass`.
4. **Deterministic rule selection on tie.** Lexicographic by `rule_id`
   so logs are reproducible.
5. **Checklist-versioned.** Verdict carries the `checklist_version` of
   the anomaly that produced it. A version bump invalidates cached
   verdicts.

---

## 6. Rollout phases (in order)

Phase 0 — **this doc**. No code.

Phase 1 — `evaluateGate` implemented, pure, fully unit-tested against
the policy table in §4. Not called from anywhere. Lives next to a
`/dev/progression-gate` harness page that lets us paste anomaly sets and
see the verdict.

Phase 2 — **Shadow gating.** `flushMasteryShadow` and the level
evaluator each *call* `evaluateGate` and *log* what they would do, but
still write the same data they write today. New table:
`progression_gate_shadow_events { trial_log_id, surface, verdict,
rule_id, would_change }`. Compared against actual outcomes in a dev
dashboard for at least 2 weeks before Phase 3.

Phase 3 — **Enforcement on `mastery_write` only.** Mastery shadow
writes start respecting `drop` and `annotate` verdicts. Level UP /
scaffold withdrawal still pass-through. This is the smallest blast
radius — mastery is already shadow-only and not user-visible.

Phase 4 — **Enforcement on `level_up`.** Adds the cue-dependency gate's
sibling: anomaly-derived UP blocks. UI continues to show "stretching"
language; never "blocked".

Phase 5 — **Enforcement on `scaffold_withdraw`.** Highest clinical
sensitivity; ships last and behind a feature flag for staged rollout.

Phase 6 — **Visible progression rollout.** Only after Phases 3–5 have
a clean shadow record.

Each phase requires:

- All tests green.
- Shadow telemetry shows the gate verdict matches reviewer expectation
  on ≥95% of sampled sessions.
- A documented rollback (just toggle the call site back to pass-through).

---

## 7. What this spec deliberately defers

- **Per-user calibration.** All thresholds are global today. A future
  spec can introduce per-user trust scores.
- **Clinician overrides.** Out of scope; will reuse the existing
  override pattern from the speech validity gate.
- **Time-decay of anomalies.** A 30-day-old D8 should probably weigh
  less than today's D8; this needs its own design.
- **Cross-rule interactions.** e.g. C3 + D3 in the same session may
  warrant a stronger verdict than either alone. Today: independent.
- **User-facing language.** No copy is defined here; gating must remain
  invisible to patients and caregivers in Phases 0–5.

---

## 8. Change process

1. Propose a row change in §4 as a doc edit. Include rationale and
   which surface it affects.
2. Land the doc change. Only then update `evaluateGate` + tests.
3. Do not introduce a verdict for a rule that does not yet exist in
   `docs/telemetry-validation-checklist.md`. Checklist always leads.
4. Removing a verdict requires a note here (date, reason, replacement).

---

**TL;DR for reviewers:** the gate is the contract that lets anomalies
*matter* without letting them *control the UI*. It is intentionally
shipped as policy first, shadow second, enforcement last — same
sequencing pattern as the mastery layer and the speech validity gate.
