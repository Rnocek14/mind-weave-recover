# Multi-Step Planning — Clinical Evidence

## Status: Structural ladder (Phase 2, Wave 2)

L1–L6 ready. L7 thin. L8 aspirational (constrained-output runtime mode not yet shipped). Ceiling clamp blocks live promotion past L7.

## Clinical basis

Multi-step procedural discourse training is supported by cognitive-communication / executive-function rehab literature:

- **Sohlberg & Mateer — Attention Process Training (APT) / cognitive-communication framework** — graded executive-sequencing tasks with progressively heavier working-memory + planning demands.
- **Script training literature** — Youmans, Holland, et al. — structured spoken-script production for functional routines is a recognized aphasia therapy approach with carryover to spontaneous discourse.
- **Procedural-discourse macrostructure work** — Ulatowska and colleagues; coverage + sequence integrity are the canonical clinical signals for this task type.

Common to these programs is a **complexity gradient**: familiar daily routines → multi-stage planning with constraints → novel/abstract goals — paired with attention to **coverage** (key steps named) and **sequence integrity** (steps in the right order).

## What is calibration, not literature

- The specific 3-tier collapse (familiar daily → multi-stage → novel/abstract) shipped here is a **clinically motivated calibration default** against the existing `PLANNING_ITEMS` bank's tier 1–3 spread. Not a head-to-head proven hierarchy.
- Per-level accuracy bars (`minOnTargetAccuracy`) and `minOnTargetAttempts` mirror PhotoNaming/FixSentence/SemanticFeatures numerics — tunable, not evidence-based constants.
- Clinical Level → engine tier floor (1→1, 5→6, 7→8, 8→10) is a sensible packing default given the bank's 1–10 difficulty spread and the 1–3 content-tier collapse.

## Support ladder (executive / open-production axis)

```
highlight_plus_choice  <  choice_based  <  open_response
(model heard + tiles)     (tiles only)     (spontaneous)
```

The current MSP game UI has **no in-trial scaffold control** — no hint button, no tile suppression toggle. The patient simply speaks. Every trial is therefore mapped to `open_response`. The ladder advances on accuracy + sequence-coverage growth at progressively harder content tiers, not on scaffold fading. This matches MSP's clinical reality (it is a discourse-production task, not a tile-assembly task).

## Mastery routing

- `submitTrial` emits `trialMode: 'production'` on every call.
- Canonical slug `multi_step_planning` IS added to `ADOPTED_TRIAL_MODE_SLUGS`.
- Trials route into expressive mastery — same path as PhotoNaming / FixSentence / SemanticFeatures / TwoClues / CategoryFluency / SentenceConstruction.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L4 | ready | Bank tier 1 / tier 1–2 boundary covered well. |
| L5–L6 | ready | Bank tier 2 multi-stage planning + constraints. |
| L7 | thin | Bank tier 3 — novel/abstract goals, sparse; rotation only. |
| L8 | aspirational | No constrained-output runtime mode (no enforced step-count / temporal-marker UI). Ceiling clamp blocks live promotion. |

## Out of scope for this ship

- A constrained-output runtime mode (e.g., "use at least 5 steps, include temporal markers") — would unlock L8.
- Per-component sub-mastery rows (e.g., separate coverage vs sequence-integrity tracks).
- Script-rehearsal carryover analytics across sessions.
