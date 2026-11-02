# Narrative Retell — Clinical Evidence

## Status: L1–L3 practice mechanics wired; clinical L1–L8 progression still design-only

A new **read-only, patient-scoped practice-stage loader** connects the actual Narrative Retell page to the persisted `clinical_progression_state` level. When the saved level is 1, 2 or 3, the real game now selects different story complexity and visible support. The eight-stage **clinical** ladder remains unvalidated and has no automatic promotion; these are executable practice configurations, not verified medical milestones.

| Selected practice stage | Actual story bank | Help during retell | What is measured |
| --- | --- | --- | --- |
| 1 | Tier 1, short familiar sequences | Full scene cards visible | Supported story-event practice |
| 2 | Tier 1, short familiar sequences | Emoji picture sequence visible | Supported story-event practice with reduced text |
| 3 | Tier 2, cause/effect and social episodes | Sequence dots (more detail revealed if stuck) | Supported longer-story event practice |

Stage-specific selection is strict: in-session adaptation cannot silently replace a stage-3 story with an easier tier, and unimplemented stages 4–8 are disclosed rather than presented as completed. The page keeps general story practice available for a saved higher level without changing that level. All three supported stages show their own help automatically, independently of the previous feature flag. Every completed trial records the actual story tier, practice stage and used visual help; none of this triggers promotion.

A missing/failed patient-level read fails closed to an accessible recovery screen. Offline practice uses a clearly non-persisted entry configuration. The game remounts when the patient profile, session or stage changes to avoid leaking a previous patient's story/results. No patient progression state is modified by these stage changes.

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

Narrative Retell now has patient-scoped **read-only training stage selection for 1–3**, but **no clinical L1–L8 promotion hook**. The adaptive game distinguishes complete retell practice from patient recovery outcomes. A 60% main-event-coverage heuristic drives *in-game* success feedback; the exercise page previously called 30% coverage correct. The code now consistently uses the existing 60% rule but does **not** claim it is a standardized clinical outcome threshold.

The game records whether the answer was browser-recognized speech, typed fallback, or a skip. Typed text is never logged as a speech transcript, and skipped, unscorable or assisted speech does not lower or increase the independent spoken adaptive score. Visual and stall supports remain explicitly logged. Completed valid spoken retells without observed support can enter a separately labeled score denominator; all other work remains accessible as **practice participation**, with step/event-coverage measurements retained for clinician review. Any recording of recognized speech is still subject to real-world ASR uncertainty.

Legacy `exercise_events` writes are now awaited before the session is ended. The saved session's score and trial count reflect successful raw writes rather than optimistic results from pending or failed requests; a write failure is disclosed instead of silently recording a completed clinical outcome.

**Interpretation limits:** Individual event-coverage matching does not establish narrative cohesion, conversational transfer or functional communication improvement. Even the spoken denominator reflects browser-recognized mode, not independently assessed speaking ability. An SLP must review clinical thresholds, the support model, outcome definitions and examples of real aphasic language before these signals are used for treatment decisions. The game retains its existing 1–10 in-session adaptation for general practice. In configured stages 1–3, story tier and baseline support remain fixed to the selected stage while stall rescue can add support; the clinical eight-stage scoring and promotion criteria remain design-only.

## Mastery routing

- `submitTrial` is **not** wired through `useTrialSubmission`.
- Slug `narrative_retell` is **NOT** added to `ADOPTED_TRIAL_MODE_SLUGS`.
- Trials continue to flow through the discourse adaptation engine only; the training-stage loader is read-only and never calls `saveProgressionState`.
- `narrative_stage_promotion_eligible: false` is logged explicitly for new stage-selected practice; score metadata does not establish clinical-level advancement.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| Practice stage 1 | executable practice only | Tier 1 + full-scene visual assistance; no clinical promotion |
| Practice stage 2 | executable practice only | Tier 1 + emoji sequence; no clinical promotion |
| Practice stage 3 | executable practice only | Tier 2 + sequence dots with stall rescue; no clinical promotion |
| Clinical L1–L8 | aspirational | Criteria, thresholds and stored **advancement** are not implemented; functional-transfer testing is unperformed |
| Higher-stage training 4–8 | not implemented | General practice available, but no higher-stage-specific mechanics |

## Out of scope for this ship

- Macrostructure scoring at runtime (episode coverage, sequence integrity, thematic coherence).
- Novel-story bank for L8.
- Per-level mastery enforcement and promotion into `ADOPTED_TRIAL_MODE_SLUGS`.
