# Photo Naming — Clinical Evidence Basis

Lexical retrieval ladder, L1–L8. See `src/lib/progression/photoNamingLevels.ts`.

## What the design borrows from the literature

**Cueing hierarchies as a treatment for anomia.** The use of structured
cueing (semantic, phonemic, sentence-completion, recognition) as a graded
support system for word retrieval is a long-standing rehab approach.

- Linebaugh, C. W., & Lehner, L. H. (1977). *Cueing hierarchies and word
  retrieval: A therapy program.* Clinical Aphasiology.
- Boyle, M., & Coelho, C. A. (1995). *Application of semantic feature
  analysis as a treatment for aphasic dysnomia.* AJSLP, 4, 94–98.
- Kiran, S., & Thompson, C. K. (2003). *The role of semantic complexity in
  treatment of naming deficits.* JSLHR, 46(4), 773–787.

**Important nuance we do NOT overclaim.** Direct head-to-head comparisons of
semantic vs phonemic cue effectiveness are mixed. Some studies report
phonemic cues yielding higher facilitation for accuracy/latency in certain
patient profiles; others favor semantic cues for longer-term generalization.

- Hickin, J., Best, W., Herbert, R., Howard, D., & Osborne, F. (2002).
  *Phonological therapy for word-finding difficulties: a re-evaluation.*
  Aphasiology, 16(10-11), 981–999.
- Bonnans, C., & Python, G. (2021). *Facilitating word retrieval in aphasia:
  Which type of cues for which aphasic speakers?* Frontiers in Human
  Neuroscience, 15, 747391.

Our cue ordering (`recognition_only < carrier_or_full_model < phonemic_cue
< semantic_cue < independent`) is therefore a **clinical design rationale**,
not a universal evidence claim. The ordering is chosen because it reflects a
monotonic gradient of **patient-side production independence**, not a claim
about which cue type elicits more correct responses.

**Frequency effect.** Lower-frequency targets are systematically harder to
retrieve in aphasic naming. SUBTLEX-US is the frequency source we plan to
adopt for L4 → L5 → L6 content tiering.

- Brysbaert, M., & New, B. (2009). *Moving beyond Kučera and Francis: A
  critical evaluation of current word frequency norms and the introduction
  of a new and improved word frequency measure for American English.*
  Behavior Research Methods, 41(4), 977–990.

**Criterion-based mastery (70–85% bands).** Single-subject treatment
studies in SFA/PCA commonly use ~80% accuracy across two consecutive
sessions as a probe-criterion for advancing or releasing a target set.

The Challenge Point Framework (Guadagnoli & Lee, 2004, J Motor Behavior)
motivates running learners near the upper edge of difficulty where success
rate is high enough to sustain learning but low enough to demand effort.
The framework is **motor-learning–derived** and was not validated
specifically in aphasia rehab; we use it as an implementation heuristic to
justify why our L1–L3 bars sit at 70% and L7–L8 at 85%, not as proof.

## Specific calibration defaults shipped

| Parameter | Value | Status |
|---|---|---|
| `SUPPORT_CREDIT` (independent → recognition) | 1.0 / 0.6 / 0.4 / 0.2 / 0.0 | Clinically motivated default. Ordering reflects production-independence gradient; magnitudes are tunable. |
| L1–L3 accuracy bar | 70% | Consistent with Challenge Point lower band; not a proven aphasia mastery threshold. |
| L4–L5 accuracy bar | 70–75% | Same. |
| L6–L8 accuracy bar | 80–85% | Approximates 80%-criterion convention in SFA single-subject designs. |
| `trialWeight` per level | 0.4 → 2.5 | Calibration default chosen for "perfect cadence" sessions-to-graduate (L1≈3, L8≈22). Not derived from the literature. |
| L5–L8 content tiers | TBD (SUBTLEX freq, category breadth, phrase carrier, generalization probe) | Not yet implemented — see PR3 in `.lovable/plan.md`. |

## What we deliberately do not claim

- That the literature proves the exact `SUPPORT_CREDIT` numbers.
- That 80% is **the** mastery criterion for any individual patient.
- That semantic cues are always more or less effective than phonemic cues.
- That the Challenge Point Framework's success bands transfer 1:1 from
  motor learning to aphasic word retrieval.

All numeric defaults must remain tunable per profile via the clinician
override pathway; nothing here is locked in.
