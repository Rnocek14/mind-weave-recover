# Narrative Retell — Clinical Evidence

## Status: Design-of-record (Phase 2, Wave 4)

Published clinical design only. Runtime continues to ride the existing discourse adaptation engine. No progression hook, no difficulty bridge, no mastery routing, no per-level mastery enforcement.

## Clinical basis

Story-retell is a long-standing aphasia discourse measure. The ladder draws on:

- **Story-grammar / macrostructure analysis** — Ulatowska et al.; Stein & Glenn — setting, initiating event, attempt, outcome, ending as canonical story components.
- **Discourse-in-aphasia work** — Wright & Capilouto; Armstrong — main-concept analysis and coherence as primary scoring frames.
- **Script training** — Youmans, Holland — graded retell with progressive scaffold fading and carryover to spontaneous discourse.

The ladder advances on narrative complexity (short sequential → episodic with goal/attempt/outcome → multi-episode with theme → long narratives with character perspective and causality).

## What is calibration, not literature

- The 4-stage complexity collapse is a **clinically motivated design default** against the current narrative-retell bank.
- "Coherence" and "thematic" credit at L6–L7 would require scoring infrastructure that does not yet exist at runtime.
- Per-level accuracy bars / attempts are intentionally **not** specified.

## Mastery routing

- `submitTrial` is **not** wired through `useTrialSubmission`.
- Slug `narrative_retell` is **NOT** added to `ADOPTED_TRIAL_MODE_SLUGS`.
- Trials continue to flow through the discourse adaptation engine only.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L8 | aspirational | No runtime ladder enforcement — design-of-record only. |

## Out of scope for this ship

- Macrostructure scoring at runtime (episode coverage, sequence integrity, thematic coherence).
- Novel-story bank for L8.
- Per-level mastery enforcement and promotion into `ADOPTED_TRIAL_MODE_SLUGS`.
