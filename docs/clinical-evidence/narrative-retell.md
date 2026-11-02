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

## Current runtime evidence integrity (November 2026)

Narrative Retell still has **no operational L1–L8 clinical progression hook**. The adaptive game distinguishes complete retell practice from patient recovery outcomes. A 60% main-event-coverage heuristic drives *in-game* success feedback; the exercise page previously called 30% coverage correct. The code now consistently uses the existing 60% rule but does **not** claim it is a standardized clinical outcome threshold.

The game records whether the answer was browser-recognized speech, typed fallback, or a skip. Typed text is never logged as a speech transcript, and skipped, unscorable or assisted speech does not lower or increase the independent spoken adaptive score. Visual and stall supports remain explicitly logged. Completed valid spoken retells without observed support can enter a separately labeled score denominator; all other work remains accessible as **practice participation**, with step/event-coverage measurements retained for clinician review. Any recording of recognized speech is still subject to real-world ASR uncertainty.

Legacy `exercise_events` writes are now awaited before the session is ended. The saved session's score and trial count reflect successful raw writes rather than optimistic results from pending or failed requests; a write failure is disclosed instead of silently recording a completed clinical outcome.

**Interpretation limits:** Individual event-coverage matching does not establish narrative cohesion, conversational transfer or functional communication improvement. Even the spoken denominator reflects browser-recognized mode, not independently assessed speaking ability. An SLP must review clinical thresholds, the support model, outcome definitions and examples of real aphasic language before these signals are used for treatment decisions. The game retains its existing 1–10 in-session adaptation and design-only eight-stage plan.

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
