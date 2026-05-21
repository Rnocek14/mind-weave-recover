# Detective Mind — Clinical Evidence

## Status: Structural ladder, **receptive-safe** (Phase 2, Wave 2)

L1–L5 ready. L6–L7 thin. L8 aspirational (bank not yet extended with novel/abstract case content). Ceiling clamp blocks live promotion past L7.

## Clinical basis

Inferential reading comprehension and discourse-comprehension training is supported in cognitive-communication / aphasia rehab:

- **Sohlberg & Mateer — APT-II, Inference and Reasoning module** — graded inferential-comprehension drills, factual → simple inference → multi-step inference.
- **Conversational discourse remediation work** — Cherney, Boyle, et al. — inferential comprehension is a recognized treatment target for mild-to-moderate aphasia and right-hemisphere communication disorders.
- **Reading-for-meaning hierarchies** — clinical practice patterns (PALPA, ASHA) consistently order content as: factual → bridging inference → elaborative/causal inference → abstract/novel-domain inference.

Common to these programs is a **complexity gradient** in both passage length / linguistic load AND question type (factual recall vs. bridging inference vs. multi-step inference), with **independent reading** (no scaffolding) as the long-run target.

## What is calibration, not literature

- The specific 3-tier collapse (factual → simple inferential → multi-step inference) shipped here is a **clinically motivated calibration default** against the existing `DETECTIVE_CASES` bank's tier 1–3 spread and `questionType` taxonomy. Not a head-to-head proven hierarchy.
- Per-level accuracy bars + `minOnTargetAttempts` mirror MeaningMatch numerics — tunable, not evidence-based constants.
- Clinical Level → engine tier floor (1→1, 5→6, 7→8, 8→9) is a sensible packing default.

## Support ladder (comprehension axis)

```
recognition_only  →  semantic_cue
(multi-choice, no hint)   (sentence-highlight hint used)
```

Detective Mind does **not** escalate beyond `semantic_cue`. The "on-target" rule is inverted relative to expressive ladders: a trial that used the highlight-hint does **not** meet an independent-comprehension rung's target (L3+).

## Mastery routing — receptive-safe (NOT in ADOPTED_TRIAL_MODE_SLUGS)

- `submitTrial` emits `trialMode: 'recognition'`.
- Canonical slug `detective_mind` is **INTENTIONALLY NOT** added to `ADOPTED_TRIAL_MODE_SLUGS`.
- Routing this comprehension task into the expressive mastery track would conflate axes. **Receptive mastery track is deferred.** Same precedent as MeaningMatch and MinimalPairs.
- What this ladder DOES drive today: persistent Clinical Level (1–8), engine-difficulty floor via the bridge, ceiling clamp, soft-regression scaffolding parity. No mastery rows; no level-up gating from longitudinal mastery confidence.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L2 | ready | Bank tier 1 factual cases with hint allowed. |
| L3–L5 | ready | Bank tier 2 — factual → inferential → mixed, no hint. |
| L6–L7 | thin | Bank tier 3 multi-step inference cases are sparse; rotation only. |
| L8 | aspirational | Novel/abstract-domain cases not yet in bank. Ceiling clamp blocks live promotion. |

## Out of scope for this ship

- Receptive mastery track (would let `recognition` trials contribute to longitudinal mastery without contaminating the expressive axis).
- Per-question-type sub-mastery rows (factual vs. inferential vs. multi-step).
- Novel-domain abstract-case bank expansion (would unlock L8 substantively).
