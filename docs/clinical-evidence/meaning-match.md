# Meaning Match — Clinical Evidence (Phase 1, Wave 1)

## Receptive-safe variant — important framing

Meaning Match is a **receptive / comprehension** task: the patient sees a
target word and selects its meaning from competing options. A keyword-
highlight hint is available on demand. We therefore ship its L1–L8 ladder
on the **comprehension axis** and intentionally **do NOT** add the slug to
`ADOPTED_TRIAL_MODE_SLUGS`. Its `submitTrial` continues to emit
`trialMode: 'recognition'`, which routes to `excluded` in
`masterySignalRouting` and so does NOT contaminate the expressive mastery
EWMA. A receptive-mastery track is the right home for this game and is
explicitly deferred.

This matches the precedent set by Minimal Pairs (also a receptive task).

## What this ladder DOES drive today

- Persistent Clinical Level (1–8) on `clinical_progression_state` for
  `meaning-match`.
- Engine-difficulty FLOOR via `meaningMatchDifficultyBridge`. Live session
  adaptation may still escalate above the floor.
- Ceiling clamp via `computeImplementedCeiling` — L8 is `aspirational`
  (`contentSelector.implemented: false`); advancement past L7 is blocked
  until the figurative/idiomatic bank ships.
- Soft-regression scaffolding parity with PhotoNaming / FixSentence /
  SemanticFeatures: `supportBaseline ≥ 2` lowers the engine floor by 1 step
  for the next session.

## Clinical grounding

Comprehension hierarchies for aphasia are well-established in
single-word-comprehension batteries (PALPA, BDAE, WAB) and in ASHA
practice patterns:

- **Concrete > abstract:** concrete imageable items are easier than
  abstract concepts at the single-word level (Bird et al., 2000;
  Sandberg & Kiran, 2014).
- **Distant > close semantic distractors:** picking a target against
  distant distractors is easier than against close semantic neighbours
  (Howard & Patterson 1992, PALPA subtests).
- **Frequency effects:** high-frequency lexemes are easier than
  low-frequency lexemes across receptive tasks.
- **Figurative comprehension** is dissociable from literal comprehension
  and is reliably more impaired in fluent aphasia (Papagno 2001).

## Honest scope

The **direction** of this ladder (concrete → abstract, distant → close
distractors, hint → no hint) is grounded in the literature above. The
**specific per-level accuracy bars (0.70 → 0.85), trialWeights, and the
mapping of Clinical L1–L8 onto the universal 1–10 difficulty tier (floor:
1,2,3,4,6,7,8,9)** are **clinically motivated calibration defaults, not
literature-proven constants.** They must remain tunable.

- **L1–L5:** `ready` — content bank carries ≥7 trials per band.
- **L6–L7:** `thin` — bank coverage is sparse; rotation is honest for
  short-term practice but cannot sustain heavy mastery work.
- **L8:** `aspirational` — figurative/idiomatic bank has not shipped.
  Ceiling clamp blocks advancement past L7 until the bank exists.

## Support-axis mapping (comprehension)

| In-game state           | Canonical `SupportLevel` |
| ----------------------- | ------------------------ |
| No hint used            | `recognition_only`       |
| Keyword highlight used  | `semantic_cue`           |

Meaning Match never escalates beyond `semantic_cue`.

## Files

- Levels:   `src/lib/progression/meaningMatchLevels.ts`
- Bridge:   `src/lib/progression/meaningMatchDifficultyBridge.ts`
- Hook:     `src/hooks/useMeaningMatchProgression.ts`
- Page:     `src/pages/MeaningMatchExercise.tsx`
