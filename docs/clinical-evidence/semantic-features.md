# Clinical Evidence — Semantic Features (SFA)

## TL;DR
Semantic Feature Analysis is well-supported in the anomia literature
(Boyle & Coelho 1995; Coelho et al. 2000; Maddy et al. 2014). The
*direction* of progression — scaffolded perceptual features →
independent functional → cross-domain associative — is consistent with
SFA protocols. The specific per-level accuracy bars, `trialWeight`
divisors, and bank-difficulty mapping shipped here are
**clinically motivated calibration defaults**, not literature-proven
constants. They must remain tunable as real adherence data accumulates.

## Support ladder (lexical axis, shared with Photo Naming)
```
recognition_only → carrier_or_full_model → phonemic_cue
                → semantic_cue → independent
```
SFA's in-game `cueLevel` (0..2 from `usedRatio`) maps:
- `0` → `independent`
- `1` → `semantic_cue`
- `2` → `phonemic_cue`

`recognition_only` and `carrier_or_full_model` are reserved for future
multi-modal variants and are not emitted by the current game.

## Per-level rationale
| L | Bank difficulty | Target support | Clinical claim | Readiness |
|---|---|---|---|---|
| 1 | 1 (perceptual) | semantic_cue | Patient picks correct perceptual features when chips are visible | ready |
| 2 | 1 | semantic_cue | Consolidation at perceptual tier | ready |
| 3 | 2 (functional) | independent | Generates functional features without scaffold | ready |
| 4 | 2 | independent | Mixed functional + categorical features | ready |
| 5 | 3 (categorical) | independent | Broader semantic spread | ready |
| 6 | 3–4 | independent | Associative / cross-domain features | thin |
| 7 | 4 | independent | Mixed-abstractness under pressure | thin |
| 8 | 5 | independent | Abstract / low-frequency targets | thin |

## Honest scope notes
- **Bank depth.** `semanticFeatureBank` now ships 20 trials at every
  difficulty (d=5 expanded 9 → 20 to open L8). The d=5 register is
  pinned by `semanticFeatureBankIntegrity.test.ts`: low-frequency nouns
  with ≥2 abstractness-5 correct features (house/hand grandfathered).
- **L8 is live but new.** `readiness: 'thin'` until field data and SLP
  review of the AI-authored d=5 additions; the ceiling clamp now allows
  promotion to L8. The L6 bridge floor (bank difficulty 3) is a flagged
  decision in `docs/unimplemented-tiers-roadmap.md`.
- **No untrained-probe tier.** Unlike Photo Naming L8, SFA does not
  ship a separate probe bank. All trials sit inside the training
  distribution.
- **Cue model is bank-internal.** `cueLevel` is computed from the SFA
  game's `usedRatio` and represents *patient reliance on the visible
  feature options*. It is not a clinician-set parameter and does not
  fade between sessions automatically.

## References (selected)
- Boyle, M., & Coelho, C. A. (1995). Application of semantic feature
  analysis as a treatment for aphasic dysnomia. *AJSLP*, 4(4), 94–98.
- Coelho, C. A., McHugh, R. E., & Boyle, M. (2000). Semantic feature
  analysis as a treatment for aphasic dysnomia: A replication.
  *Aphasiology*, 14(2), 133–142.
- Maddy, K. M., Capilouto, G. J., & McComas, K. L. (2014). The
  effectiveness of semantic feature analysis: An evidence-based
  systematic review. *Annals of Physical and Rehabilitation Medicine*,
  57(4), 254–267.
