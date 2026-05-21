# Fix the Sentence — Clinical Evidence Basis

Sentence-repair independence ladder, L1–L8. See
`src/lib/progression/fixSentenceLevels.ts`. This game is **not** a lexical
retrieval task; the ladder targets the ability to detect a structural or
semantic error in a sentence and produce a coherent repair with decreasing
scaffolding.

## What the design borrows from the literature

**Sentence-level treatment in aphasia.** Treatment paradigms such as
Mapping Therapy (Schwartz et al., 1994), Treatment of Underlying Forms
(Thompson & Shapiro, 2005), and Verb Network Strengthening Treatment
(Edmonds, 2014) all demonstrate that targeted sentence-level work
generalizes to spontaneous production when scaffolding is faded
systematically. We borrow the **principle of staged scaffold-fading**, not
any specific protocol's mechanics.

- Schwartz, M. F., Saffran, E. M., Fink, R. B., Myers, J. L., & Martin, N.
  (1994). *Mapping therapy: A treatment programme for agrammatism.*
  Aphasiology, 8(1), 19–54.
- Thompson, C. K., & Shapiro, L. P. (2005). *Treating agrammatic aphasia
  within a linguistic framework: Treatment of Underlying Forms.*
  Aphasiology, 19(10-11), 1021–1036.
- Edmonds, L. A. (2014). *Tutorial for Verb Network Strengthening Treatment
  (VNeST).* Perspectives on Neurophysiology and Neurogenic Speech and
  Language Disorders, 24(3), 78–88.

**Scaffold gradient (highlight + choice → choice → open).** The ordering
mirrors the recognition → recall continuum standard in cognitive rehab
generally; it is a clinical design rationale, not a literature-proven cue
ranking.

## Specific calibration defaults shipped

| Parameter | Value | Status |
|---|---|---|
| Support order | `highlight_plus_choice < choice_based < open_response` | Clinically motivated default; reflects scaffold-fading principle. |
| `SUPPORT_CREDIT` | 0.4 / 0.6 / 1.0 | Calibration default; magnitudes are tunable. |
| L1–L4 accuracy bar | 70% | Heuristic; not a proven aphasia mastery threshold. |
| L5–L8 accuracy bar | 75–85% | Approximates 80%-criterion convention in sentence-treatment single-subject designs. |
| `trialWeight` per level | 0.4 → 2.5 | Calibration default. Not derived from the literature. |
| L5–L8 content tiers | Tier stubs only (see PR4 in `.lovable/plan.md`) | Bank work deferred; cards will mark these "pending" until stimuli land. |

## What we deliberately do not claim

- That the cue/scaffold order has been validated in head-to-head trials
  specifically for sentence repair.
- That a single accuracy band defines mastery for any individual patient.
- That fading scaffolds in this exact sequence generalizes to spontaneous
  speech without supplementary intervention.
