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
| L5 two-error tier | Live (`FIX_SENTENCE_TWO_ERROR_BANK` + two-phase repair loop) | See `docs/fix-sentence-two-error-spec.md`; stimuli pending SLP review. |
| L6 mixed morphology | Live tagged inflection bank; strict-form scoring | Stimuli require SLP review; scores are constrained practice evidence. |
| L7 embedded clauses | 24 adult functional relative/complement-clause connector repairs; strict lexical scoring | Partial tier pending SLP evaluation. The task is one-word correction, not free complex-sentence generation. |
| L8 open-ended repair | Not implemented | Keeps the clinical ceiling at L7 until an open-ended scoring/validation path exists. |

## What we deliberately do not claim

- That the cue/scaffold order has been validated in head-to-head trials
  specifically for sentence repair.
- That a single accuracy band defines mastery for any individual patient.
- That fading scaffolds in this exact sequence generalizes to spontaneous
  speech without supplementary intervention.


## Level 7 implementation (draft review branch)

A dedicated cohort of 24 practical embedded-clause sentences now targets **relative-pronoun and complement-clause connector repair**. Examples of the task form include replacing *which* with *who* in “The nurse which called me …” or *which* with *that* in “I hope which the appointment starts on time.” The patient can speak the replacement word or a corrected sentence; the screen still presents the source sentence. This is **not** spontaneous independent generation of complex syntax.

- The L7 clinical selector loads only explicitly tagged embedded-clause stimuli. Levels 4–6 retain their own distinct content. In-session 1–10 difficulty changes replace upcoming items **within the saved clinical syntax cohort** rather than swapping in unrelated baseline items.
- L7 connector scoring uses approved exact replacements without phonetic, plural, or embedding-based near-matches. This deliberately sacrifices some recognition flexibility to avoid false success on the grammatical contrast. Real aphasic-speech recognition accuracy is not established.
- The existing progression threshold is **six independent on-target attempts**, so a standard L7 session now offers at least six questions. It does not lower the evidence requirement just to make the level advance.
- L7 remains **partially implemented** in clinical-facing surfaces due to unreviewed stimuli and uncalibrated scoring. L8 continues to display as **planned**, with no automatic progression beyond L7.

Clinical review is needed for item grammaticality, dialectal alternatives, potentially acceptable patient responses, motor-speech/ASR ambiguity, fatigue and therapy appropriateness. An authenticated isolated backend and representative real-device aphasic-speech test are also required before patient release.
