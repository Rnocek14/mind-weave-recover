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

The current Synonym Generator UI has no hint button, cue chips, or model audio. It allows recognized speech **and** typed input. Both can count toward practice engagement, but only a **completed timed speech-only round** now routes through `open_response` as clinical progression evidence. Typed, mixed, silent and **Done early** rounds are retained as observable practice but excluded from the verified speech score, clinical-level buffer, in-session spoken adaptation, and expressive mastery. `open_response` labels support in eligible spoken rounds; it does not turn typed output into independent speech.

## Mastery routing

- Full timed speech-only rounds emit `trialMode: 'production'`. Typed, mixed, no-response and early-ended rounds emit the unscored `mixed` routing tag with the **actual** `input_mode` and `completion_reason` kept separately in telemetry.
- Canonical slug `synonym_generator` remains adopted; only eligible `production` rows can enter expressive mastery. Typed/mixed practice cannot inflate the spoken clinical ladder or its scored denominator.
- The game and the page now use the **same existing** match thresholds (2 at engine levels 1–2, 3 at 3–4, 4 at 5+). Previously the page incorrectly accepted two matches at every difficulty.
- The final raw event write completes before the session commits progression and mastery. A failed raw insert cannot silently buffer a supposedly successful final round.
- Browser recognition remains a provisional observation: these changes do **not** verify the speaker, clinical correctness, aphasic recognition fidelity, or transfer to outside communication.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L3 | ready | Bank tier 1 (concrete common) covers this range well. |
| L4–L5 | ready | Bank tier 2 (mixed-frequency) covers this range well. |
| L6 | thin | Bank tier 2/3 boundary (abstract mid-frequency); rotation only. |
| L7 | thin | Bank tier 3 (abstract low-frequency); sparse coverage. |
| L8 | aspirational | No constrained-output runtime mode (typing fallback always available; no enforced speech-only or extreme per-prompt minimums). Ceiling clamp blocks live promotion. |

## Measurement limitations

The current 45-to-25-second timer varies with difficulty and may confound word productivity with lexical complexity. **This wave did not change the timer or the clinician-unreviewed eight-stage thresholds.** It records both the time cap and actual duration and excludes early-ended rounds from scored clinical evidence. Cross-tier outcome interpretation still requires norming and SLP review, ideally with stable independent probes.

## Out of scope for this ship

- A constrained-output runtime mode (e.g., "speech-only, ≥6 matches in 25 s") — would unlock L8.
- Per-component sub-mastery rows (e.g., separate productivity vs precision tracks).
- Carryover analytics from synonym generation into untrained naming probes across sessions.
