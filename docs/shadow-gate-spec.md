# Shadow Progression Gate — Architecture Spec

**Status:** v0.1 — spec only
**Pass type:** Architecture / design
**Date:** 2026-05-07
**Companion specs:**
- `docs/progression-gating-spec.md` (rule semantics, D1–D9, timing)
- `docs/receptive-assisted-mastery-spec.md` (excluded-evidence channels)
- `mem://architecture/mastery-layer-shadow` (expressive mastery shadow)

> This document defines the **shadow progression gate**: a pure, observation-only
> simulation layer that records what progression governance *would have done* if it
> were enforcing. It does not enforce. It does not mutate mastery. It does not
> block UP. It does not change scaffold state. It is not visible to patients or
> clinicians in v0.1.

---

## 1. Purpose

The platform now has typed telemetry, trial-mode-respecting expressive mastery
(Photo Naming), trial/session/window-scope anomaly detection (D1–D9 observation),
and a frozen archetype theory layer. The next architectural step is to *simulate*
progression governance decisions against real telemetry **before** any enforcement
surface is wired.

The shadow gate exists to answer:

- What would governance have done at each progression-relevant surface?
- Which rules would dominate the decision stream?
- Where are the likely false positives, contradictions, or under-defined cases?
- Is current adopted-slug coverage (Photo Naming only) enough to learn anything?

It is a **learning surface**, not a control surface.

## 2. Non-goals (v0.1)

The shadow gate explicitly does **not**:

- Enforce or soft-warn at any surface.
- Mutate expressive mastery, scaffold state, level, or visible progress.
- Surface anything to patients or clinicians.
- Introduce new anomaly rules (it consumes existing D1–D9 only).
- Implement receptive or assisted mastery influence (deferred to that spec).
- Run real-time synthetic D1/D2 in-session gating (per timing-semantics fix).
- Tune thresholds, weights, or rule precedence.
- Expand adopted slugs. Slug expansion is a separate decision, see §9.
- Persist delay state, cooldowns, or cross-session "pending" decisions.

## 3. Surfaces to simulate

The shadow gate is invoked (purely, with no side effects) at the same hook points
where a real gate would eventually live:

| Surface              | Where it would attach (future)                          | What the gate would govern                  |
|----------------------|---------------------------------------------------------|---------------------------------------------|
| `mastery_write`      | `flushMasteryShadow` / future expressive write path     | Whether a trial contributes to mastery      |
| `level_up`           | `useInGameAdaptation.recordTrial` (in-game UP path) and next-session escalation eligibility | Whether UP is allowed |
| `scaffold_withdraw`  | Future scaffold state machine                           | Whether support may be withdrawn this step  |
| `visible_progress`   | Patient/clinician progress surfaces                     | Whether a level/mastery change is shown     |

In v0.1 the gate only **records** at these surfaces. It does not attach to live
control flow.

## 4. Inputs

The gate is a **pure function** of:

- Current trial (post-validation, post-routing)
- Trial-mode routing verdict (`production | recognition | scaffolded | exposure | mixed | null`)
- Adopted-slug membership (currently `{ photo-naming }`)
- Recent trial-scope anomalies (D1–D5 family, as defined in gating spec)
- Current session anomalies (session-scope rules)
- Recent user×slug window anomalies (D8 scaffold creep, D9 withdrawal regression)
- Current surface identifier (one of §3)
- Optional: recent "clean evidence" count from existing shadow mastery (read-only)

The gate **must not** read or write any new state store in v0.1.

## 5. Output shape (proposed, not yet implemented)

```ts
interface ShadowGateDecision {
  surface: 'mastery_write' | 'level_up' | 'scaffold_withdraw' | 'visible_progress';
  decision: 'pass' | 'drop' | 'delay' | 'annotate';
  rule_ids: string[];          // contributing rule ids (D1, D8, ...)
  reasons: string[];           // human-readable reasons, one per rule_id
  inputs_snapshot: object;     // minimal frozen view of inputs used
  would_change: boolean;       // true iff decision != 'pass'
  checklist_version: string;   // gating-spec version at time of decision
  created_at: string;          // ISO timestamp
}
```

Decision semantics (v0.1 intent only):

- **pass** — governance would allow the surface action unchanged.
- **drop** — governance would suppress this contribution entirely (e.g. mastery_write of a non-production trial under a policy that excludes it).
- **delay** — governance would defer the action to a later eligibility window (e.g. next-session UP suppression after D1/D2). State ownership for delay is **unresolved**, see §10.
- **annotate** — governance would allow the action but tag it with a flag (e.g. "scaffold-creep observed"). Weighting semantics for annotate are **unresolved**, see §10.

## 6. Adopted-slug gating

The shadow gate runs **only** for trials whose `exercise_slug` is in the adopted
set (currently `photo-naming`). All other trials are skipped silently — no
shadow decision is recorded.

This preserves the same discipline used by mastery shadow, recency exclusion,
and D8/D9: contracts are validated one slug at a time before broader rollout.

## 7. Interaction with existing layers

| Layer                              | Shadow gate interaction                              |
|------------------------------------|------------------------------------------------------|
| Mastery signal routing             | Consumes the routing verdict; does not alter it      |
| Expressive mastery (shadow)        | Reads recent clean count if available; never writes  |
| Receptive/assisted mastery spec    | Out of scope — gate ignores receptive/assisted       |
| Anomaly detector (D1–D9)           | Consumes anomalies as inputs; does not create rules  |
| `useInGameAdaptation.recordTrial`  | In-game UP surface to simulate (no live attach v0.1) |
| `drillTriggerEvaluator`            | Unrelated — Smart Coach drill surface, not gating    |
| Patient/clinician UI               | No interaction in v0.1                                |

## 8. Learning questions (what shadow data must answer)

Before any enforcement work is approved, shadow data should answer:

1. **Frequency** — How often would each surface be non-`pass`?
2. **Rule dominance** — Which `rule_ids` drive the most non-`pass` decisions?
3. **False-positive risk** — On clinician-reviewed sessions, how often does a non-`pass` look wrong?
4. **D8/D9 correlation** — Do scaffold-creep and withdrawal-regression windows correlate with surfaces the gate would block, or are they orthogonal?
5. **Coverage** — Is Photo Naming alone producing enough non-trivial decisions to learn from, or is a second adopted slug required?
6. **Delay realism** — Does the `delay` verdict require persistent state to be meaningful, or can next-session-only semantics carry v1?
7. **Annotate utility** — Is `annotate` distinguishable from `pass` in practice, or does it collapse?

## 9. Adopted-slug decision (deferred)

Expanding the adopted-slug set is a **separate decision** that follows this spec,
not part of it. Rationale: deciding to adopt a second slug *to feed the gate*
before the gate's learning questions are formalized would invert the dependency.

Recommended sequencing:
1. Land this spec.
2. Implement S1 (pure `evaluateGate` + tests, no DB).
3. Implement S2 (shadow writes for Photo Naming only).
4. Inspect S3 dev surface and answer learning question #5.
5. **Then** decide whether to adopt a scaffolded/cueing-heavy slug to surface D8/D9-driven decisions.

## 10. Open design risks

Called out explicitly so they are not silently resolved during implementation:

- **Delay state ownership.** A `delay` verdict that means "next session" is fine; a `delay` that means "until N more clean trials" requires a state store the platform does not yet have. v0.1 implementation should restrict `delay` to next-session semantics only.
- **Annotate weighting.** If `annotate` is purely advisory, it may be indistinguishable from `pass` in analysis. Either define a downstream consumer or collapse it.
- **D1/D2 post-session timing.** Per gating-spec §4a, session-scope rules influence the *next* session, not the current one. The shadow gate must reflect this — no retroactive in-session `drop`/`delay` for D1/D2.
- **Stale anomaly handling.** The gate has no resolution/expiration model for anomalies. An old D8 may keep generating non-`pass` decisions. v0.1 should bound the input window (e.g. anomalies from the last N sessions) and document the bound.
- **Adopted-slug narrowness.** Photo Naming alone may not exercise scaffold-withdraw or D8/D9-driven surfaces meaningfully. This is a known limitation of v0.1, accepted in exchange for contract discipline.
- **Checklist drift.** `checklist_version` must be stamped on every decision so later analysis can attribute behavior to a specific gating-spec revision.

## 11. Rollout phases

| Phase | Scope                                                                 | Gate writes? | UI? |
|-------|-----------------------------------------------------------------------|--------------|-----|
| S0    | This spec                                                             | No           | No  |
| S1    | Pure `evaluateGate(input) → ShadowGateDecision` + unit tests          | No           | No  |
| S2    | `gate_shadow_decisions` table + write path at simulated surfaces      | Yes (shadow) | No  |
| S3    | `/dev/shadow-gate` review surface (engineering only)                  | Yes          | Dev |
| S4    | Clinician review of sampled sessions; learning-question evaluation    | Yes          | Dev |
| S5    | **Only then** consider live enforcement at a single surface (likely `mastery_write` for non-production drops first) | TBD | TBD |

No phase past S0 is approved by this document. Each subsequent phase requires
its own decision.

## 12. Out of scope (reaffirmed)

- New tables, columns, migrations.
- Code changes.
- Mastery computation changes.
- Anomaly rule additions or threshold tuning.
- Adopted-slug expansion.
- Patient or clinician UI.
- Real-time in-session gating.
- Receptive/assisted mastery influence.

---

**Spec complete.** Next concrete pass (when approved) is S1: implement
`evaluateGate` as a pure function with unit tests, no DB, no surface attachment.
