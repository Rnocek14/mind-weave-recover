# Two Clues — Clinical Evidence (Phase 1, Wave 1)

## What this game does

Patient is given two converging semantic clues and produces the target
word. After silence or struggle an **anchor word** may be revealed
(semantic scaffold). This makes Two Clues an expressive lexical-retrieval
task that implements the core mechanism of **Semantic Feature Analysis
(SFA)** at a coarser grain: instead of generating features, the patient
*consumes* converging features to retrieve a target.

## Clinical grounding

- **Semantic Feature Analysis (Boyle & Coelho 1995; Coelho et al. 2000;
  Maddy et al. 2014; Efstratiadou et al. 2018 meta-analysis):** converging
  semantic features facilitate lexical retrieval in anomia. Improvements
  generalize within trained semantic categories.
- **Frequency and concreteness effects** on naming are well-replicated
  (Nickels & Howard 1995). Treatment outcomes improve when difficulty is
  graded by these axes.
- **Cueing hierarchy fading** (Linebaugh & Lehner 1977; later cueing-
  hierarchy work) supports the design of fading the anchor as patients
  progress.

## What this ladder DOES drive today

- Persistent Clinical Level (1–8) on `clinical_progression_state` for
  `two-clues`.
- Engine-difficulty FLOOR via `twoCluesDifficultyBridge` (1–10 universal
  tier; floor map: 1,2,3,4,6,7,8,9).
- Ceiling clamp — L8 is `aspirational` (`contentSelector.implemented:
  false`); advancement past L7 is blocked until the figurative/idiomatic
  bank ships.
- Soft-regression scaffolding parity with the rest of the Tier-A core.
- Routing into the **expressive mastery EWMA**: slug is added to
  `ADOPTED_TRIAL_MODE_SLUGS`, and the page emits `trialMode: 'production'`
  on every `submitTrial`. `TwoCluesGame`'s adaptation auto-logger remains
  `autoLog: false` (already the case before Wave 1) so no untagged rows
  leak into routing.

## Honest scope

The **direction** of the ladder (concrete → abstract, frequent → rare,
anchor-supported → independent) is grounded in the literature above. The
**specific per-level accuracy bars (0.70 → 0.85), trialWeights, and bank-
difficulty mapping** are **clinically motivated calibration defaults, not
literature-proven constants.** They must remain tunable.

- **L1–L5:** `ready` — bank coverage is robust.
- **L6–L7:** `thin` — bank coverage is sparse for low-frequency / abstract
  pressure tiers.
- **L8:** `aspirational` — figurative bank not yet shipped; ceiling clamp
  blocks live promotion.

## Support-axis mapping (lexical)

| In-game state         | Canonical `SupportLevel` |
| --------------------- | ------------------------ |
| Solved cold (no anchor) | `independent`          |
| Anchor word shown     | `semantic_cue`           |

Two Clues never escalates to `phonemic_cue`, `carrier_or_full_model`, or
`recognition_only`.

## Files

- Levels:   `src/lib/progression/twoCluesLevels.ts`
- Bridge:   `src/lib/progression/twoCluesDifficultyBridge.ts`
- Hook:     `src/hooks/useTwoCluesProgression.ts`
- Page:     `src/pages/TwoCluesExercise.tsx`
- Routing:  `ADOPTED_TRIAL_MODE_SLUGS` in `src/lib/mastery/masterySignalRouting.ts`
