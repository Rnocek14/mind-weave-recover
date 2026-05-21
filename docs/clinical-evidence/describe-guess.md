# Describe & Guess — Clinical Evidence

## Status: Design-of-record (Phase 2, Wave 4)

Published clinical design only. Runtime continues to ride the existing discourse adaptation engine and the legacy `cueLevel 0–3` telemetry mapping. There is **no** progression hook, **no** difficulty bridge, **no** mastery routing, and **no** per-level mastery enforcement.

This document reserves the intended L1–L8 ladder so a future structural migration can promote the game without redesigning it.

## Clinical basis

Describe & Guess inverts the standard SFA frame: the patient is the describer, and the system (or partner) is the guesser. This makes it a feature-production task with strong overlap with:

- **Semantic Feature Analysis** — Boyle & Coelho (1995); Maddy, Capilouto & McComas (2014) meta-analysis. Feature generation strengthens semantic-network access supporting lexical retrieval.
- **PACE — Promoting Aphasic Communicative Effectiveness** — Davis & Wilcox. Patient transmits information whose target the partner does not know; communicative success is the criterion.
- **Conversation-as-therapy traditions** — Hopper, Holland, Simmons-Mackie — for the "patient leads, partner negotiates" stance.

The complexity ladder (concrete/high-frequency → mixed → abstract / low-imageability) is the standard imageability/frequency gradient used across the lexical-semantic literature.

## What is calibration, not literature

- The 3-tier content collapse (concrete-HF → mixed → abstract / low-imageability) is a **clinically motivated design default** against the existing `describeGuessBank`.
- The mapping of cueLevel 0–3 to the SupportLevel ladder is documented in the registry but not enforced per level.
- Per-level accuracy bars and attempts are intentionally **not** specified — runtime does not enforce them and we must not publish numerics the engine does not honor.

## Mastery routing

- `submitTrial` is **not** wired through `useTrialSubmission` for this game (`autoLog` left at its current value).
- Slug `describe_guess` is **NOT** added to `ADOPTED_TRIAL_MODE_SLUGS`.
- Trials continue to flow through the discourse adaptation engine only.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L8 | aspirational | No runtime ladder enforcement — design-of-record only. |

## Out of scope for this ship

- Per-level mastery enforcement, ceiling clamps, and bridge wiring.
- Novel-target bank for L8.
- Promotion into `ADOPTED_TRIAL_MODE_SLUGS`.
