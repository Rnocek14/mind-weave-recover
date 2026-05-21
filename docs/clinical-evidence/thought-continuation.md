# Thought Continuation — Clinical Evidence

## Status: Design-of-record (Phase 2, Wave 4)

Published clinical design only. Runtime continues to ride the existing discourse adaptation engine. No progression hook, no difficulty bridge, no mastery routing, no per-level mastery enforcement.

## Clinical basis

Open-ended thought continuation targets **propositional density** and **discourse cohesion**:

- **Discourse-in-aphasia frameworks** — Wright & Capilouto; Armstrong — propositional density and cohesion as primary outcome dimensions.
- **MacWhinney CHAT / CLAN discourse analysis** tradition — clause-by-clause coherence and connective use as scoring targets.
- **Cognitive-communication rehab** — Sohlberg & Mateer — graded reflective tasks for executive-discourse integration after brain injury.

The ladder advances on cohesion class: single on-topic proposition → multi-proposition coherent → multi-proposition with causal/temporal linking → reflective / hypothetical extension on novel prompts.

## What is calibration, not literature

- The 4-band complexity collapse (concrete → everyday → reflective → abstract/hypothetical) is a **clinically motivated design default** against the current `thoughtPromptBank`.
- "Coherence", "connective use", and "reason-giving" credit at L4–L6 would require scoring infrastructure that does not yet exist at runtime.
- Per-level accuracy bars / attempts are intentionally **not** specified.

## Mastery routing

- `submitTrial` is **not** wired through `useTrialSubmission`.
- Slug `thought_continuation` is **NOT** added to `ADOPTED_TRIAL_MODE_SLUGS`.
- Trials continue to flow through the discourse adaptation engine only.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L8 | aspirational | No runtime ladder enforcement — design-of-record only. |

## Out of scope for this ship

- Propositional-density / cohesion scoring at runtime.
- Novel-prompt bank for L8 and sustained-turn scoring.
- Per-level mastery enforcement and promotion into `ADOPTED_TRIAL_MODE_SLUGS`.
