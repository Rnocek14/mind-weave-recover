# Describe & Guess — Clinical Evidence

## Status: Design-of-record (Phase 2, Wave 4)

Published clinical-stage design only. Runtime continues to use the existing discourse adaptation engine and `cueLevel 0–3` telemetry intensity mapping. There is **no** per-game clinical progression hook, **no** difficulty bridge, **no** adopted expressive mastery routing, and **no** per-level mastery enforcement.

**Measurement-integrity update:** The game already uses `useTrialSubmission` for raw practice events, but the canonical slug remains **outside** the expressive-mastery adoption list. The new evidence classifier distinguishes **uncued spoken production**, **semantically prompted spoken practice**, and **typed practice** in each raw event. This improves reporting accuracy but does not turn the stage definitions into operational L1–L8 progression.

This document reserves the intended L1–L8 ladder so a future structural migration can promote the game without redesigning it.

## Clinical basis

Describe & Guess inverts the standard SFA frame: the patient is the describer, and the system (or partner) is the guesser. This makes it a feature-production task with strong overlap with:

- **Semantic Feature Analysis** — Boyle & Coelho (1995); Maddy, Capilouto & McComas (2014) meta-analysis. Feature generation strengthens semantic-network access supporting lexical retrieval.
- **PACE — Promoting Aphasic Communicative Effectiveness** — Davis & Wilcox. Patient transmits information whose target the partner does not know; communicative success is the criterion.
- **Conversation-as-therapy traditions** — Hopper, Holland, Simmons-Mackie — for the "patient leads, partner negotiates" stance.

The complexity ladder (concrete/high-frequency → mixed → abstract / low-imageability) is the standard imageability/frequency gradient used across the lexical-semantic literature.

## What is calibration, not literature

- The 3-tier content collapse (concrete-HF → mixed → abstract / low-imageability) is a **clinically motivated design default** against the existing `describeGuessBank`.
- The number of semantic help prompts is recorded on a 0–3 `cueLevel` intensity axis. The prompts ("Use", "Where", "Looks like", etc.) are **semantic**, not phonemic or full spoken models; the runtime now maps **all** prompted trials to `semantic_cue` support rather than mislabeling two prompts as phonemic and three as a full model. This is cue-type integrity, not an enforced per-level support-fading ladder.
- Per-level accuracy bars and attempts are intentionally **not** specified — runtime does not enforce them and we must not publish numerics the engine does not honor.

## Mastery and score routing

- `DescribeGuessExercise` already writes raw events through `useTrialSubmission`. It has `progression:null` because no eight-stage progression engine is implemented.
- `describe_guess` is **NOT** in `ADOPTED_TRIAL_MODE_SLUGS`, so the expressive mastery shadow remains intentionally unwired.
- Independent, meaningful browser-recognized speech with **no tapped help prompts** is marked `trial_mode:'production'` and eligible for the explicitly identified independent spoken-practice score denominator.
- Spoken trials with semantic prompt chips are marked `trial_mode:'scaffolded'` and include the actual prompt count and `semantic_cue` support. They are not credited as independent speech.
- Typed answers are `trial_mode:'mixed'` for exclusion, and `input_mode:'typed'` in telemetry. They retain participation and practice feedback without being credited as spoken performance. Missing provenance fails closed.
- The game no longer sends typed responses into the audio/utterance analysis pathway or the spoken adaptive-difficulty logger. This does not prove browser ASR accuracy on aphasic speech.
- An event score remains an **in-app heuristic** (meaning conveyed / target retrieval / strategy use), not a standardized clinical outcome or evidence of successful conversation outside the app.

## Unverified safeguards and next steps

The raw save-barrier in draft PR #108 protects session finalization for `useTrialSubmission` games, but real authenticated persistence, clinician-facing aggregate reconciliation, patient devices, and SLP review still need verification. A complete L1–L8 progression build will require separately authored level content, specific clinically reviewed promotion evidence, accessible cue control, and independent functional-communication probes.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L8 | aspirational | No runtime ladder enforcement — design-of-record only. |

## Out of scope for this ship

- Per-level mastery enforcement, ceiling clamps, and bridge wiring.
- Novel-target bank for L8.
- Promotion into `ADOPTED_TRIAL_MODE_SLUGS`.
