# Abstract Compare — Clinical Evidence

## Status: Design-of-record (Phase 2, Wave 4)

Published clinical design only. Runtime continues to ride the existing discourse adaptation engine. No progression hook, no difficulty bridge, no mastery routing, no per-level mastery enforcement.

## Clinical basis

Similarities-and-differences tasks are core to abstract-reasoning assessment in both neuropsychology and aphasiology:

- **WAIS Similarities subtest** — Wechsler — categorical and abstract concept comparison.
- **BDAE Auditory Comprehension of Concept Comparisons** — Goodglass, Kaplan, Barresi — graded similarity judgments for aphasia.
- **Concept-comparison literature** in cognitive-communication rehab — Marini, Andreetta — for the use of superordinate-naming and relational-similarity credit as separable signals.

The ladder advances on conceptual abstraction: same-category concrete pairs → cross-category with superordinate naming → mixed concrete/abstract with relational similarity → abstract pairs with multi-dimensional comparison.

## What is calibration, not literature

- The 4-stage abstraction ladder is a **clinically motivated design default** against the existing `abstractCompareStimuli` bank.
- "Dimensionality" credit (number of shared dimensions surfaced) at L6–L7 would require scoring infrastructure that does not yet exist at runtime.
- Per-level accuracy bars / attempts are intentionally **not** specified.

## Mastery routing

- `submitTrial` is **not** wired through `useTrialSubmission`.
- Slug `abstract_compare` is **NOT** added to `ADOPTED_TRIAL_MODE_SLUGS`.
- Trials continue to flow through the discourse adaptation engine only.

## Readiness

| Level | Readiness | Notes |
| --- | --- | --- |
| L1–L8 | aspirational | No runtime ladder enforcement — design-of-record only. |

## Out of scope for this ship

- Dimensionality / relational-similarity scoring at runtime.
- Novel-pair bank for L8.
- Per-level mastery enforcement and promotion into `ADOPTED_TRIAL_MODE_SLUGS`.
