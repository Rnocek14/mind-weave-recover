# Minimal Pairs — Clinical Evidence Basis

Auditory phonemic discrimination ladder, L1–L8. See
`src/lib/progression/minimalPairsLevels.ts`.

## What the design borrows from the literature

**Phonological-input impairment is a real and measurable deficit in
aphasia**, particularly (but not exclusively) in Wernicke's / fluent
profiles. Minimal-pair AB discrimination is the standard task for
assessing it.

- Robson, H., Sage, K., & Lambon Ralph, M. A. (2012). *Wernicke's aphasia
  reflects a combination of acoustic-phonological and semantic control
  deficits: A case-series comparison of Wernicke's aphasia, semantic
  dementia and semantic aphasia.* Neuropsychologia, 50(2), 266–275.
- Binder, J. R., Pillay, S. B., Humphries, C. J., Gross, W. L., Graves, W.
  W., & Book, D. S. (2017). *Surface errors without semantic impairment in
  acquired dyslexia: A voxel-based lesion-symptom mapping study.* Brain,
  140(5), 1475–1489.
- Johnson, J. C. S., et al. (2020). *Impaired phonemic discrimination in
  logopenic variant primary progressive aphasia.* Annals of Clinical and
  Translational Neurology, 7(7), 1252–1257.

**Phonetic-feature confusability gradient** (place > manner > voicing in
relative ease, roughly speaking) is well documented in adult phoneme
discrimination work. Our L4 → L5 → L6 content tiering (place → manner →
voicing) is a **clinical design rationale** anchored in that general
literature, not a claim that this exact ordering is the rehab-validated
sequence for aphasic listeners.

**Noise / under-load discrimination (L7–L8).** Comprehension under
acoustic degradation is a recognized real-world demand and is increasingly
used as an outcome measure. The specific runtime mechanics (SNR injection,
response-time pressure, triplet discrimination) are **not yet
implemented** in our system — L7 and L8 are aspirational placeholders
until that infrastructure exists.

## Per-trial support model

Two tiers are emitted today:

- `first_listen` → independent (target tier).
- `after_replay` → scaffolded (patient pressed the replay button ≥ 1×).

The shared `SupportLevel` union also defines `after_multiple_replays`
(rank 0) for future granularity; it is not yet emitted by the runtime.

## Specific calibration defaults shipped

| Parameter | Value | Status |
|---|---|---|
| `SUPPORT_CREDIT` | first_listen 1.0 / after_replay 0.7 / after_multiple_replays 0.4 | Clinically motivated default; ordering reflects degree of patient-side independence, not a proven listening-effort metric. |
| L1–L4 accuracy bar | 70–75% | Heuristic; not a proven phonemic-discrimination mastery threshold. |
| L5–L8 accuracy bar | 75–85% | Approximates 80%-criterion convention used in phonological treatment single-subject designs. |
| `trialWeight` per level | 0.4 → 2.5 | Calibration default. |
| L5–L8 content tiers | Manner → voicing → noise / triplet (PR5) | L4 (place) ready; manner/voicing tier work + noise injection pending. |

## What we deliberately do not claim

- That `first_listen` vs `after_replay` is a literature-validated support
  hierarchy for minimal-pair discrimination.
- That place > manner > voicing is **the** difficulty ordering for any
  individual aphasic listener.
- That our chosen accuracy bands are evidence-based thresholds.
- That L7–L8 are clinically meaningful **today** — they are placeholders
  until the noise / pressure runtime ships.
