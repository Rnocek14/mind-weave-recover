# Conversation Coach — Clinical Evidence

## Status: Design-of-record (Phase 2, Wave 4)

Published clinical design only. Runtime continues to ride the existing Smart Coach / discourse adaptation engine with its strategy switching and SCA cueing. No progression hook, no difficulty bridge, no mastery routing, no per-level mastery enforcement.

## Clinical basis

Conversation Coach is a didactic conversational-therapy frame. The ladder draws on:

- **Supported Conversation for Adults with Aphasia (SCA)** — Kagan; Kagan, Black, Duchan, Simmons-Mackie & Square — IN / OUT / VERIFY scaffolding pattern.
- **PACE — Promoting Aphasic Communicative Effectiveness** — Davis & Wilcox — communicative success as the criterion, with graded message-transfer demands.
- **Conversation Therapy** — Hopper, Holland — turn-by-turn scaffolded practice in functional conversational contexts.
- **Aphasia-friendly conversation training** — Simmons-Mackie partner-training meta-analyses for the general principle that communicative independence is the long-arc target.

The ladder advances on communicative independence: scripted exchanges with full models → choice-supported turns under SCA → semantic-cue-then-open → independent on-topic turns → multi-turn topic maintenance → topic initiation → conversational repair.

## What is calibration, not literature

- The 4-stage independence ladder is a **clinically motivated design default**. Specific stages (e.g., "topic initiation" before "repair") reflect a sensible clinical ordering, not a head-to-head proven hierarchy.
- "Topic maintenance", "topic shift", and "repair" credit at L5–L7 would require scoring infrastructure that does not yet exist at runtime.
- Per-level accuracy bars / attempts are intentionally **not** specified.

## Mastery routing

- `submitTrial` is **not** wired through `useTrialSubmission`.
- Slug `conversation_coach` is **NOT** added to `ADOPTED_TRIAL_MODE_SLUGS`.
- Trials continue to flow through the Smart Coach / discourse adaptation engine only.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L8 | aspirational | No runtime ladder enforcement — design-of-record only. |

## Out of scope for this ship

- Turn-level scoring of topic maintenance, topic initiation, and repair.
- Per-level mastery enforcement and promotion into `ADOPTED_TRIAL_MODE_SLUGS`.
- Any change to the existing Smart Coach strategy-switching / SCA cueing runtime.
