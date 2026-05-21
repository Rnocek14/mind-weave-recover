# Conversation Partner — Clinical Evidence

## Status: Design-of-record (Phase 2, Wave 4)

Published clinical design only. Runtime continues to ride the existing conversation-partner agent loop with its strategy switching. No progression hook, no difficulty bridge, no mastery routing, no per-level mastery enforcement.

## Clinical basis

Conversation Partner reframes the dyad as the unit of intervention rather than the patient alone:

- **Supported Conversation for Adults with Aphasia (SCA)** — Kagan — partner is trained to acknowledge competence and reveal it.
- **Communication Partner Training (CPT) meta-analyses** — Simmons-Mackie, Raymer, Cherney — partner-skill outcomes for unfamiliar partners; ecological validity of multi-partner practice.
- **PACE** — Davis & Wilcox — naturalistic message-transfer with partner negotiation.
- **Life-Participation Approach to Aphasia (LPAA)** — Chapey et al. — functional, real-world communication across partners and contexts as the long-arc target.

Compared to **Conversation Coach** (didactic scaffolding inside a coaching frame), Conversation Partner targets **ecologically valid exchanges** with a partner persona that behaves more like a real interlocutor. The ladder advances on partner-load: familiar topic with highly predictable partner → naturalistic partner with minimal repair → patient-led topic shifts → unfamiliar partner with register adaptation → multi-party / cross-context exchanges.

## What is calibration, not literature

- The partner-load progression (predictable → naturalistic → unfamiliar → multi-party) is a **clinically motivated design default** mapped onto the existing conversation-partner agent.
- "Register adaptation", "multi-party", and "context-shift" credit at L7–L8 would require runtime infrastructure (multiple partner personas, multi-party simulation, register scoring) that does not yet exist.
- Per-level accuracy bars / attempts are intentionally **not** specified.

## Mastery routing

- `submitTrial` is **not** wired through `useTrialSubmission`.
- Slug `conversation_partner` is **NOT** added to `ADOPTED_TRIAL_MODE_SLUGS`.
- Trials continue to flow through the conversation-partner agent / discourse adaptation engine only.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L8 | aspirational | No runtime ladder enforcement — design-of-record only. |

## Out of scope for this ship

- Multiple partner personas with distinct registers.
- Multi-party simulation and context-shift scoring.
- Per-level mastery enforcement and promotion into `ADOPTED_TRIAL_MODE_SLUGS`.
- Any change to the existing conversation-partner agent runtime.
