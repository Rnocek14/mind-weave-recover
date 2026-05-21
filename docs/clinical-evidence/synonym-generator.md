# Synonym Generator — Clinical Evidence

## Status: Structural ladder (Phase 2, Wave 3)

L1–L5 ready. L6–L7 thin. L8 aspirational (constrained-output runtime mode not yet shipped). Ceiling clamp blocks live promotion past L7.

## Clinical basis

Divergent lexical-semantic production (give multiple synonyms / category members for a target) is supported by the aphasia rehab literature on semantic-network strengthening and verbal-fluency intervention:

- **Semantic Feature Analysis (SFA)** — Boyle 2004; Kiran & Thompson 2003 — repeated activation of multi-feature semantic networks improves both trained and untrained word retrieval.
- **VNeST (Verb Network Strengthening Treatment)** — Edmonds et al. 2009 — divergent generation of related arguments around a target strengthens lexical-semantic access with carryover.
- **Verbal-fluency intervention reviews** — semantic-category fluency tasks are a standard probe of and target for semantic-system integrity; timed productive output is a recognized rehab paradigm.

Common to these programs is a **complexity gradient on the target word**: concrete high-frequency → mixed-frequency → abstract low-frequency — paired with attention to **productive count** (number of valid related items produced in a window).

## What is calibration, not literature

- The specific 3-tier collapse (concrete common → mixed-frequency → abstract) shipped here is a **clinically motivated calibration default** against the existing `SYNONYM_PROMPTS` bank's tier 1–3 spread. Not a head-to-head proven hierarchy.
- Per-level accuracy bars (`minOnTargetAccuracy`) and `minOnTargetAttempts` mirror PhotoNaming/FixSentence/SemanticFeatures/SentenceConstruction/MultiStepPlanning numerics — tunable, not evidence-based constants.
- The in-game success threshold (≥2 / ≥3 / ≥4 valid matches at progressively higher difficulty) is an existing calibration default (`getSuccessThreshold` in the game), inherited unchanged.
- Clinical Level → engine tier floor (1→1, 5→6, 7→8, 8→10) is a sensible packing default given the bank's 1–10 difficulty spread and the 1–3 content-tier collapse.

## Support ladder (lexical / open-production axis)

```
highlight_plus_choice  <  choice_based  <  open_response
(model heard + cues)      (cue chips)      (spontaneous)
```

The current Synonym Generator game UI has **no in-trial scaffold control** — no hint button, no cue chips, no model audio. The patient just speaks (or types via the input-mode fallback; that is an input-modality fallback, not a clinical scaffold). Every trial is therefore mapped to `open_response`. The ladder advances on match-count growth at progressively harder content tiers and progressively tighter time windows, not on scaffold fading. This matches Synonym Generator's clinical reality (it is a divergent-retrieval task, not a cue-faded confrontation-naming task).

## Mastery routing

- `submitTrial` emits `trialMode: 'production'` on every call.
- Canonical slug `synonym_generator` IS added to `ADOPTED_TRIAL_MODE_SLUGS`.
- Trials route into expressive mastery — same path as PhotoNaming / FixSentence / SemanticFeatures / TwoClues / CategoryFluency / SentenceConstruction / MultiStepPlanning.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L3 | ready | Bank tier 1 (concrete common) covers this range well. |
| L4–L5 | ready | Bank tier 2 (mixed-frequency) covers this range well. |
| L6 | thin | Bank tier 2/3 boundary (abstract mid-frequency); rotation only. |
| L7 | thin | Bank tier 3 (abstract low-frequency); sparse coverage. |
| L8 | aspirational | No constrained-output runtime mode (typing fallback always available; no enforced speech-only or extreme per-prompt minimums). Ceiling clamp blocks live promotion. |

## Out of scope for this ship

- A constrained-output runtime mode (e.g., "speech-only, ≥6 matches in 25 s") — would unlock L8.
- Per-component sub-mastery rows (e.g., separate productivity vs precision tracks).
- Carryover analytics from synonym generation into untrained naming probes across sessions.
