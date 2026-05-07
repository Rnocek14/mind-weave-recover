# Shadow Gate Replay Semantics — Architecture Spec

**Status:** v0.1 — spec only
**Pass type:** Architecture / design
**Date:** 2026-05-07
**Companion specs:**
- `docs/shadow-gate-spec.md` (gate purpose, surfaces, non-goals)
- `docs/progression-gating-spec.md` (rule → verdict policy table)
- `docs/receptive-assisted-mastery-spec.md` (excluded-evidence channels)

> This document defines **how shadow gate decisions persist, replay, and version
> over time** — *before* any `gate_shadow_decisions` table exists. The shape of
> persistence encodes the answer to the replay question, so the answer must
> precede the schema.

---

## 1. Why this spec exists now

`evaluateGate` is now a pure, deterministic, side-effect-free function (S1).
That purity unlocks a capability the platform has not previously had:
**reproducible governance decisions**.

But persistence design will *encode* the replay model whether we choose one
deliberately or not. If we ship S2 with the wrong shape, replay semantics
become extremely costly to change later. This spec answers the model question
once, so S2 can implement against a pinned contract.

The fork at hand:
- **Ephemeral** — log decisions for live observation only; throw away history.
- **Immutable snapshots** — persist decisions as frozen historical facts.
- **Fully recomputable** — store only inputs; treat decisions as derived.

**Decision: hybrid — immutable snapshots + additive counterfactual recompute.**

## 2. Core invariant

The governance identity function is:

```
(trial_id, surface, gate_policy_version, checklist_version, adopted_slug_set_version)
  → ShadowGateDecision
```

**Same key, same answer, always.** This is the non-negotiable invariant of the
replay system. Every operational and schema decision in §§4–9 derives from it.

Consequences:
- A decision row is uniquely identified by that 5-tuple.
- Re-running the gate with the same 5-tuple must yield byte-equivalent output
  (modulo `created_at`).
- Changing *any* version axis produces a *new* row, never overwrites an old one.
- Two rows that differ only in their version axes are a *legitimate replay
  comparison*, not a contradiction.

## 3. Three-axis versioning

Every persisted decision carries three independent version stamps:

| Axis                         | Bumped when                                              | Owner                          |
|------------------------------|----------------------------------------------------------|--------------------------------|
| `gate_policy_version`        | The §4 rule→verdict table in `progression-gating-spec.md` changes; the `POLICY` map in `gate.ts` changes; strictest-wins ordering changes. | progression theory layer |
| `checklist_version`          | Anomaly detector's rule definitions, thresholds, or scope semantics change. (Already exists on anomaly rows.) | telemetry validation checklist |
| `adopted_slug_set_version`   | The `ADOPTED_GATE_SLUGS` set changes (slug added or removed). | shadow-gate-spec rollout decisions |

A fourth implicit axis — `evaluateGate` code itself — must be kept in lockstep
with `gate_policy_version`. The code does not get its own version; instead, any
behavioral change to `evaluateGate` is treated as a `gate_policy_version` bump.
This avoids two-axis drift on the gate's own logic.

**Rule:** A version bump on any axis is a one-way door. Never decrement, never
silently re-use a prior version number after a behavioral change.

## 4. Three replay modes (explicit taxonomy)

The replay system supports exactly three modes. Each has a distinct purpose,
risk profile, and consumer.

| Mode                  | Purpose                                                    | Inputs used                                  | Risk           | Primary consumer                |
|-----------------------|------------------------------------------------------------|----------------------------------------------|----------------|---------------------------------|
| **Historical replay** | Reproduce exactly what the gate decided at the time.       | Stored snapshot row.                         | None.          | Audit, clinician review.        |
| **Counterfactual replay** | "What would the *current* policy decide on past trials?" | Past trial + past anomalies (frozen) + **current** `gate_policy_version`. | Low (gate-only). | Governance evolution analysis.  |
| **Substrate replay**  | "What would the *current* anomaly detector + current policy decide on past trials?" | Past trial (frozen) + **recomputed** anomalies + **current** policy. | **High.** Substrate has shifted. | Research only; never operational. |

### 4.1 Historical replay

Trivial. Read the snapshot row. Output is the row. No computation needed.

### 4.2 Counterfactual replay

Re-run `evaluateGate` over the *frozen* historical anomaly snapshot using a
*newer* `gate_policy_version` and/or `adopted_slug_set_version`. The
`checklist_version` is held fixed at whatever produced the original anomalies.

This is safe because the substrate (the anomalies the gate consulted) is
unchanged. We are asking only: *given the same evidence, would today's policy
have ruled differently?*

Output is a **new row** with the new version axes. The old row is preserved
intact. The pair `(old_row, new_row)` is the comparison.

### 4.3 Substrate replay

Re-run the anomaly detector over historical trial logs *and* re-run the gate
over the resulting anomalies. Both `checklist_version` and `gate_policy_version`
are at current values.

This is **dangerous** because it answers a counterfactual question on a
counterfactual substrate. Two systems changed simultaneously; the result
cannot be cleanly attributed to either.

**v0.1 posture:** substrate replay is permitted only as a manually-invoked
research operation, clearly labeled as such, never run as part of clinician
review or operational dashboards. Substrate replay outputs MUST be tagged with
a `substrate_replay = true` flag so they are never confused with operational
decisions.

### 4.4 Forbidden modes

The following are **not** replay modes and must not be supported:

- **Mutating an existing decision row.** History never changes.
- **Deleting a decision row to "rerun" it.** The right operation is to insert
  a new row with new version axes.
- **Replaying with mismatched anomaly+policy versions where neither is "current".**
  e.g. running `gate_policy_version=v0.1` over `checklist_version=v0.4` anomalies.
  Possible in principle, semantically meaningless in practice. Not supported in v0.1.

## 5. Anomaly immutability semantics

Replay correctness depends on whether the *substrate* (anomalies the gate
consulted) is itself stable. This spec pins the contract:

**Anomalies are immutable once emitted, scoped by `checklist_version`.**

Specifically:

- An anomaly row, once written, is never updated or deleted in normal
  operation. It is a frozen statement of "the v=N detector said X about
  trial T at time t."
- A new `checklist_version` does **not** retroactively rewrite old anomaly
  rows. New anomalies under the new version are written as new rows; old
  rows remain valid evidence of what the old detector saw.
- Substrate replay (§4.3) does *not* delete or supersede the original
  anomalies. It writes new anomaly rows tagged with the current
  `checklist_version` and `substrate_replay = true`.
- Anomaly resolution (e.g. clinician review marking a D5 as a false
  positive) does **not** mutate the anomaly row. It writes a separate
  `anomaly_review` row that the gate may optionally consult in a future
  policy version. The original row stays intact.

Consequence: an anomaly row's `(rule_id, scope_ref_hash, checklist_version)`
tuple is a **permanent historical fact**. The gate's `inputs_snapshot` may
reference anomalies by id with confidence that the referenced rows still
exist and still mean what they meant.

## 6. Decision granularity per surface

Per-surface granularity matches where the *real* governance surface fires:

| Surface             | Granularity              | Rationale                                                                  |
|---------------------|--------------------------|----------------------------------------------------------------------------|
| `mastery_write`     | one row per **trial**    | Mastery contributions are per-trial; per-trial granularity preserves attribution. |
| `level_up`          | one row per **session × user × slug** | UP eligibility is evaluated at session boundaries (next-session per §4a of gating spec). |
| `scaffold_withdraw` | one row per **session × user × slug** | Same as `level_up`; withdrawal decisions are session-scoped events. |
| `visible_progress`  | one row per **session × user × slug** | When v0.1 has no rules routing here, this surface produces zero rows; structure pre-defined for symmetry. |

**Rule:** A single (granularity-key, surface, version-tuple) produces at most
one decision row. Re-evaluation under the same version-tuple is idempotent
(no duplicate row).

## 7. Persisted decision shape (logical, not schema)

Every persisted decision row contains:

- **Identity**
  - `decision_id` (synthetic primary key)
  - `surface`
  - Granularity key: `trial_id` (for `mastery_write`) OR `session_id + user_id + exercise_slug` (for session-scoped surfaces)
- **Version axes** (the 5-tuple from §2)
  - `gate_policy_version`
  - `checklist_version`
  - `adopted_slug_set_version`
- **Decision**
  - `decision` ∈ `{ pass | drop | delay | annotate }`
  - `rule_ids[]`
  - `reasons[]`
  - `would_change` (boolean)
- **Provenance**
  - `inputs_snapshot` — the §5 of `gate.ts` snapshot, stored verbatim
  - `anomaly_ref_ids[]` — pointers to the specific anomaly rows the gate consulted
  - `created_at`
  - `created_by` ∈ `{ live | counterfactual_replay | substrate_replay }`
  - `substrate_replay` boolean (for §4.3 outputs)
  - Optional: `replay_of_decision_id` — when this row is a replay comparison, the original it was replayed from.

Persistence-shape commitments:

1. **No payload mutation, ever.** Once written, every field is frozen.
2. **No PII in `inputs_snapshot`.** Only structural ids: trial_id,
   session_id, user_id, exercise_slug, trial_mode, anomaly rule_ids. No
   transcripts, audio refs, scores, or response_text.
3. **Surface lives as a column, not a partition.** All four surfaces share
   one logical decision stream. Replay queries should never need a UNION
   across tables.
4. **Anomaly references are by id, not by snapshot.** The gate's
   `inputs_snapshot` records anomaly *ids*; the immutability contract in §5
   guarantees those rows still exist with the same content.

## 8. Stale anomaly bound

The shadow-gate spec flagged an open risk: an old D8 may keep generating
non-`pass` decisions indefinitely. This spec resolves the bound:

- The **input window** for window-scope anomalies (D7, D8, D9) when
  evaluating a given trial/session is **the most recent N=12 sessions for
  that user × slug**, matching the existing detector window in
  `detect-telemetry-anomalies/index.ts`.
- For session-scope anomalies (D1–D5) the input window is **the
  immediately preceding session for that user × slug**, consistent with
  §4a's "next-session" semantics in the gating spec.
- For trial-scope anomalies (S1–S8, S10, C1–C8), the relevant anomalies
  are exactly those pinned to the trial under evaluation. No window.

These bounds are part of the gate's input contract. Counterfactual replay
(§4.2) MUST use the same window definitions; otherwise the replay is not
substrate-stable and silently degrades into substrate replay.

## 9. Retention

- **Live decisions:** retained indefinitely in v0.1. They are the learning
  corpus and the audit record.
- **Counterfactual replay decisions:** retained indefinitely. They are
  small, additive, and analytically valuable.
- **Substrate replay decisions:** retained, but flagged. May be pruned by
  research operations explicitly; never automatically.
- **No automatic deletion of any decision row in v0.1.**

If retention pressure ever forces deletion, the deletion must be by
*decision_id ranges* tied to a documented operational reason, never by
"latest replaces oldest" semantics that would mask history.

## 10. Operational surfaces (deferred)

This spec does not define:

- The schema of `gate_shadow_decisions` (S2 work).
- The write path that calls `evaluateGate` and persists the result (S2 work).
- The dev review surface `/dev/shadow-gate` (S3 work).
- The recompute job that produces counterfactual decisions (post-S3 work).
- The clinician review UI (post-S4 work).

These are downstream of, and constrained by, this spec. They are not part
of this pass.

## 11. Open risks (called out)

- **`gate_policy_version` discipline.** A bump must be a deliberate,
  reviewed action. If `POLICY` in `gate.ts` is edited without a version
  bump, historical replay silently lies. **Mitigation:** the version is
  asserted in unit tests against a constant; any change to `POLICY`
  requires the constant to be updated explicitly. (To be implemented in S2.)
- **`adopted_slug_set_version` discipline.** Same risk. Same mitigation.
- **Anomaly detector silent edits.** If the detector's behavior changes
  without a `checklist_version` bump, substrate stability is broken. The
  detector's own tests should pin behavior per checklist version.
- **Cross-axis combinatorial growth.** With three version axes and
  recompute capability, decision counts grow combinatorially across
  policy bumps. v0.1 acceptance: this is fine while the corpus is small;
  a future archival policy may be needed.
- **Substrate replay misuse.** The single biggest semantic hazard. v0.1
  mitigation is the `substrate_replay` flag and the rule that it never
  appears in operational dashboards.
- **Anomaly review records.** §5 introduces `anomaly_review` rows as the
  resolution mechanism. That schema is not defined here and must be
  designed before the gate consults reviews. Until then, the gate
  ignores them.

## 12. Non-goals (reaffirmed)

- No schema.
- No code changes.
- No `gate_shadow_decisions` table.
- No write path.
- No recompute job.
- No UI.
- No anomaly_review schema.
- No adopted-slug expansion.
- No new policy rules.
- No enforcement at any surface.

## 13. Rollout

| Phase | Scope                                                                   | Approved by |
|-------|-------------------------------------------------------------------------|-------------|
| R0    | This spec.                                                              | This pass.  |
| R1    | Version-axis enforcement in `gate.ts`: `GATE_POLICY_VERSION` constant, asserted by tests; same for `ADOPTED_SLUG_SET_VERSION`. (Tiny code change, gated on its own review.) | TBD |
| R2    | S2: `gate_shadow_decisions` table + live write path, schema honoring §7. | TBD         |
| R3    | S3: `/dev/shadow-gate` surface; historical replay only.                  | TBD         |
| R4    | Counterfactual replay job + `/dev/shadow-gate-replay` comparison view.   | TBD         |
| R5    | Substrate replay mode, research-only, gated and labeled.                 | TBD         |

No phase past R0 is approved by this document.

---

**Spec complete.** This pass pins the replay contract so S2 can build
against a fixed answer. Next concrete pass (when approved) is R1: pin
`GATE_POLICY_VERSION` and `ADOPTED_SLUG_SET_VERSION` constants in
`gate.ts` with test-asserted discipline — still no DB, no UI.
