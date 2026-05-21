# Category Fluency — Clinical Evidence (Phase 1, Wave 1)

## What this game does

"Name as many **[category]** members as you can" within a time cap. One
*round* = one category probe. The page derives `correct = uniqueWordCount
>= rung's minUniqueWords` and feeds the support level (independent vs
`semantic_cue` if a sub-prompt was shown).

## Clinical grounding

- **Semantic-category verbal fluency** is a long-standing aphasia and
  dementia metric, with animals as the most-used probe (Henry et al. 2004
  meta-analysis; Troyer et al. 1997, 1998 for cluster/switch analysis).
- **Patients with anomia show category-specific reductions in fluency**
  that respond to semantic treatment (Kiran & Thompson 2003; Kiran 2007 —
  Complexity Account of Treatment Efficacy).
- **Action / verb fluency** is dissociable from noun fluency and probes a
  separable system (Piatt et al. 1999); placement at L7 reflects this
  separability and the heavier executive load of verb retrieval.

## What this ladder DOES drive today

- Persistent Clinical Level (1–8) on `clinical_progression_state` for
  `category-fluency`.
- Engine-difficulty FLOOR via `categoryFluencyDifficultyBridge` (1–3
  internal tier; floor map: 1,1,2,2,3,3,3,3).
- Ceiling clamp — L8 is `aspirational` (cross-domain abstract /
  figurative sets); advancement past L7 is blocked until that bank
  exists.
- Soft-regression scaffolding parity with the rest of the Tier-A core.
- Routing into the **expressive mastery EWMA**: slug is added to
  `ADOPTED_TRIAL_MODE_SLUGS`, and `CategoryFluencyExercise` is migrated
  from the legacy `useExerciseTelemetry.logTrial` to the unified
  `useTrialSubmission` pathway with `trialMode: 'production'`.
  `CategoryFluencyGame`'s adaptation auto-logger is set to
  `autoLog: false` so no untagged rows leak into routing.

## Honest scope

The **direction** of the ladder (broad → narrow → abstract → action verbs
→ figurative) reflects clinical practice patterns and the literature
above on category effects and verb-noun dissociation. The **specific
per-rung `minUniqueWords` thresholds (4 → 6), accuracy bars (0.70 →
0.85), trialWeights, and the round-as-trial convention** are **clinically
motivated calibration defaults, not literature-proven constants.** They
must remain tunable.

- **L1–L5:** `ready` — bank coverage is robust.
- **L6–L7:** `thin` — narrow abstract / action-verb probes are
  under-served.
- **L8:** `aspirational` — figurative cross-domain sets not yet shipped;
  ceiling clamp blocks live promotion.

## Support-axis mapping (lexical, generative-retrieval mode)

| In-game state         | Canonical `SupportLevel` |
| --------------------- | ------------------------ |
| No sub-prompt shown   | `independent`            |
| Category sub-prompt   | `semantic_cue`           |

Category Fluency never escalates to `phonemic_cue`,
`carrier_or_full_model`, or `recognition_only`.

## Files

- Levels:   `src/lib/progression/categoryFluencyLevels.ts`
- Bridge:   `src/lib/progression/categoryFluencyDifficultyBridge.ts`
- Hook:     `src/hooks/useCategoryFluencyProgression.ts`
- Page:     `src/pages/CategoryFluencyExercise.tsx`
- Routing:  `ADOPTED_TRIAL_MODE_SLUGS` in `src/lib/mastery/masterySignalRouting.ts`
