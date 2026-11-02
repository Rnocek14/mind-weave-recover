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

The game has no in-trial hint button or choice tiles, but **does have a typed fallback** for accessibility or microphone failure. Only an eligible, completed **spoken** response with usable content and at least two distinguishable observed step positions contributes to the game-specific clinical progression ladder and expressive mastery. Typed, skipped, invalid and sequence-unresolved attempts remain practice records, not evidence of independent speech recovery. Eligible speech is `open_response`; this label does not make typed text into speech.

## Mastery routing

- Eligible completed speech rounds emit `trialMode:'production'`. Typed, skipped, nonresponse and uncertain-sequence attempts emit an excluded `mixed` routing tag, plus explicit `input_mode`, `completion_reason`, `response_valid` and sequence provenance fields.
- The canonical slug `multi_step_planning` remains adopted for the eligible spoken-production subset. Unscorable participation never advances the patient's spoken clinical ladder or expressive mastery.
- The game and the exercise page now use the **same existing task-success criteria**: at least 60% step coverage **and** at least 50% observed step-order agreement. Previously the exercise page credited a plan with only 30% coverage, regardless of step order.
- Observed order uses distinctive words and exact multiword expressions located in the **patient's actual response**, compared with each stimulus's curated `idealOrder`. The former loop iterated the predefined key-step array and awarded any two matches a perfect order score, even if the patient reversed them. Ambiguous or insufficient order evidence is explicitly **not assessed**, not 0% patient ability.

## Clinical measurement and limitations

The sequence scorer is a **conservative lexical heuristic**, not a standardized neuropsychological or speech-language test. It does not reliably understand every paraphrase, omission, alternate valid order, temporal dependency or recognition error. A clinician must review examples before using this outcome to guide care. Goal coverage and step ordering are separate dimensions; do not report a missing order judgment as incorrect sequencing or a clinical decline.

The proposed eight-stage ladder still uses developer calibration defaults, not empirically established promotion thresholds. L8 has no operational constrained-output gameplay, and improvements in these trained tasks are not evidence of functional communication outside the app. Patient-specific, untrained real-life planning probes, representative aphasic speech, supported communication methods, and independent speech-language-pathologist evaluation remain outstanding.

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
