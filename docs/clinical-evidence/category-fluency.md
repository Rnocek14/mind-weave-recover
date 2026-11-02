# Category Fluency — Clinical Evidence (Phase 1, Wave 1)

## What this game does

"Name as many **[category]** members as you can" within a time cap. One
*round* = one category probe. The page derives `correct = uniqueWordCount
>= rung's minUniqueWords` and records actual example support separately from category content difficulty. The original difficulty-linked timer was replaced with a consistent 60-second round for comparable practice counts.

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
  `useTrialSubmission` pathway with per-round `trialMode: 'production'` only for uncued recognized speech, `scaffolded` for example-supported spoken responses and `mixed` for typed or mixed-input practice.
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
| Visible example words (including L1) or extra examples on request | `semantic_cue` |

Category Fluency never escalates to `phonemic_cue`,
`carrier_or_full_model`, or `recognition_only`.

## Current measurement and transfer boundaries

- L1 shows example words at round start and is coded as semantic support. Later clinical levels begin without visible examples; requested examples are logged as actual support. Showing additional examples is not independent language production.
- A 60-second time window is constant across in-session difficulty changes. A round ended early still stores its actual duration separately.
- Spoken-only recognized words may inform the stored clinical ladder; typed, mixed and empty-input rounds are retained as practice records but are **excluded from spoken clinical progression**. Recognition errors, other speakers and device noise still require separate real-audio validation.
- Raw event writes finish before the game calls session-end progression persistence; failed writes do not feed the ladder.
- Adaptation level, category tiers and L6–L8 content remain incomplete relative to a distinct eight-stage clinical construct. Unique-word thresholds are provisional implementation defaults, not clinical norms. Untrained categories and a clinician-administered functional outcome remain a future evaluation requirement.

## Files

- Levels:   `src/lib/progression/categoryFluencyLevels.ts`
- Bridge:   `src/lib/progression/categoryFluencyDifficultyBridge.ts`
- Hook:     `src/hooks/useCategoryFluencyProgression.ts`
- Page:     `src/pages/CategoryFluencyExercise.tsx`
- Routing:  `ADOPTED_TRIAL_MODE_SLUGS` in `src/lib/mastery/masterySignalRouting.ts`
