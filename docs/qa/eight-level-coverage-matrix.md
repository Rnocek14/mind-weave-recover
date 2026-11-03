# NeuroSpark: Eight-Level Clinical Design Coverage Matrix

**Scope:** 28 canonical adult activities in `src/data/canonicalExerciseRegistry.ts`, plus the patient-facing noncanonical Command Scenes route. This document records what the code actually implements, not what a clinical study has proved.

**Required distinction:** "Eight designed stages" does NOT mean eight independently selectable, longitudinally scored and clinically validated levels. In the 13 already wired games, a stage must have actual implemented content and the established per-game evidence rules before the persistent `clinical_progression_state` level can advance to it. Every other game retains its existing nonclinical or generic difficulty controls.

- 28/28 canonical activities and 1 additional Command Scenes activity have individually described L1–L8 stage designs (29 × 8 = 232 qualitative descriptions).
- 13/29 activities have real per-game, persisted clinical progression hooks.
- 16/29 are design-only, with no numeric mastery rule, evidence-based promotion or level persistence.
- **4 of the 13 currently wired ladders** now report an L8-selectable ceiling: Photo Naming and Semantic Features (existing upper-level caveats), plus Meaning Match and Two Clues (new dedicated 16-item L8 banks; clinician, ASR, and contextual scoring review pending). "Selectable" does not imply a validated clinical improvement measure.
- The other 9 live games still cap at L6 or L7 until distinct content and evidence handling are implemented.
- Automated coverage tests prevent any newly added canonical game from escaping the eight-design contract, but cannot establish real content or clinical efficacy.

## Current catalog (source: production progression modules and registry)

| Game | Eight designed stages | Persisted per-game clinical levels? | Current implemented ceiling | Release constraint |
| --- | --- | --- | ---: | --- |
| Photo Naming | Yes | Yes | 8 | L7 carrier/frequency caveat; L8 advanced review has historic exposure caveat |
| Semantic Features | Yes | Yes | 8 | L6–L8 sparse content; independent evidence needs clinician evaluation |
| Fix the Sentence | Yes | Yes | 6 | L7 embedded clauses and L8 open-ended repair not wired |
| Minimal Pairs | Yes | Yes (receptive) | 6 | L7 degraded-signal and L8 triplet response-time tasks not built |
| Meaning Match | Yes | Yes (receptive) | 8 | L8 contextual nonliteral inference has 16 distinct items; SLP review and clinical validity pending; L6–L7 thin |
| Two Clues | Yes | Yes | 8 | L8 nonliteral convergence has 16 distinct items; ASR, valid alternatives, and SLP review pending; L6–L7 thin |
| Category Fluency | Yes | Yes | 7 | L8 figurative task not built; L6–L7 thin |
| Sentence Construction | Yes | Yes | 7 | L8 open production not built; L6–L7 thin |
| Multi-Step Planning | Yes | Yes | 7 | L8 constrained-output task not built; L7 thin |
| Detective Mind | Yes | Yes (receptive) | 7 | L8 novel abstract cases not built; L6–L7 thin |
| Synonym Generator | Yes | Yes | 7 | L8 constrained-output task not built; L6–L7 thin |
| Dual-Load Naming | Yes | Yes | 7 | L8 constrained-output mode not built; L7 thin |
| Phonological Awareness | Yes | Yes (receptive) | 7 | L8 degraded signal not built; L7 thin |
| Describe & Guess | Yes | **No** | None | Requires scoreable feature coverage and production attribution |
| Abstract Compare | Yes | **No** | None | Requires validated relation/dimension scoring and content selector |
| Narrative Retell | Yes | **No** | None | Requires story structure/coherence evidence and per-level selection |
| Thought Continuation | Yes | **No** | None | Requires proposition/cohesion assessment and per-level selection |
| Conversation Coach | Yes | **No** | None | Requires conversation-turn intent/repair assessment without caregiver/TTS contamination |
| Conversation Partner | Yes | **No** | None | Requires supported turn-taking and partner-load rubric without asserting real-world transfer |
| Phrase Practice | Yes (new design) | **No** | None | Existing ASR/phoneme scoring not sufficient for independent phrase level evidence |
| Word Finding | Yes (new design) | **No** | None | Requires distinct content/functional alternative labels; not identical to Photo Naming |
| Sentence Game | Yes (new design) | **No** | None | Must not reuse Sentence Construction progress for a distinct task |
| Thought Organization | Yes (new design) | **No** | None | Requires task-specific coherence and organization criteria |
| Follow Directions | Yes (new design) | **No** | None | Auditory/comprehension mode; do not use expressive mastery |
| Sequence Builder | Yes (new design) | **No** | None | Receptive ordering evidence requires separate scoring/assistance |
| Reach & Tap | Yes (new design) | **No** | None | Non-linguistic; needs motor-specific performance rubric and accessibility controls |
| Left-Side Hunt | Yes (new design) | **No** | None | Non-linguistic; visual neglect practice is not a validated neglect-outcome measure |
| Pattern Match | Yes (new design) | **No** | None | Non-linguistic visual working-memory; keep excluded from aphasia mastery |
| Command Scenes (supplemental route) | Yes (new design) | **No** | None | Current game emits app events only; no verified scored or persisted clinical attempt path |

**L8 activation in the stacked implementation branch:** Both new L8 banks are selected only by the patient's persisted clinical level. Generic engine difficulty 9–10 alone never unlocks them. The existing progression hooks and clinician-motivated numerical criteria remain in effect; these are content readiness updates, not newly validated clinical thresholds. Two Clues additionally records actual cue delivery independently from strong anchor matches. Automated content/unit testing is necessary but not sufficient; isolated backend, real aphasic speech, and clinician evaluations remain unverified.

**Aliases and separate modes:** `/exercise/word-practice` maps to the Phrase Practice game, and the Practice picker’s `phonological` routes to Phonological Awareness. They are not extra independent clinical games. Feed the Monster is a pediatric, device-local prototype without clinical telemetry or parental-consent infrastructure. Voice Practice is a mode with its own session logic, not a discrete adult task ladder; neither is silently assigned invented adult clinical promotion criteria.

## Required engineering acceptance criteria to activate each planned level

1. An actual distinct item bank / scene / difficulty mode or graded support condition targets that game's specifically defined skill. No unannounced fallback to basic content labeled as L8.
2. Consistent task-level evidence: correct/partially correct/error/skip; delivered cues; production vs recognition; voice validity when applicable; manual confirmation distinguished from independent output.
3. A real per-profile game progression hook loads its existing state, honors the same eight-level bounds, persists safely, and never writes a fabricated Level 1 if the state read failed.
4. Sufficient, appropriate on-target trials and on-target success demonstrated across sessions using the *existing approved game-specific* criterion framework. No guessed L8 thresholds and no blanket rule copied between unrelated tasks.
5. Clinician-visible uncertainty, content limitations and progress reasons; reasonable supported practice when a level isn't ready (without falsely awarding progress).
6. Unit + integration + browser tests prove the level-specific content changes, scoring, cue dependencies, per-patient persistence, no cross-game progress leakage, and accurate daily planning feedback.
7. SLP review for each ladder; separate permitted aphasic speech/device evaluation and regulatory/privacy readiness before hospital use.

PR #101 established **design completeness**. Stacked PR #102 adds two distinct L8 content paths and corrects Two Clues cue attribution; neither PR has been merged or deployed. **Nine** other wired games still have incomplete final-stage mechanics, and **16** design-only games still require runtime progression, game-specific evidence, and persistence. No clinical effectiveness or hospital readiness is implied.


## November 2, 2026 — nonclinical coach-probe implementation status (PR #128)

The eight-game practice wave in stacked PR #127 is followed by two additional
**playable, nonclinical** Stage 1–8 modes in the coach's activity modal:

- **Follow Directions:** concrete one-to-four-step listening/touch conditions,
  reversible written support, replay provenance, before/after and exclusion
  language, and explicit skip/error handling. These are supported auditory
  comprehension practices, **not** independent first-listen outcomes or verified
  clinical promotions.
- **Sequence Builder:** two-to-four-step routines, supported first-step reveals,
  new scenario banks, cause-and-effect questions, and two plausible sequence
  alternatives. Ordering, hints, skipping and causal accuracy remain separate
  in raw results. These are practice observations, **not** longitudinal
  discourse mastery.

The modal offers one prominent Start control and a collapsed caregiver stage
selector; the unselected path retains the original quick-practice behavior.
This brings the stacked branch to **10/29 activities with actual Stage 1–8
nonclinical practice formats** (previous eight plus these two). **19 activities
still lack the equivalent eight-stage practice implementation.** The clinical
design matrix above is deliberately unchanged: 13 persisted clinical ladders,
their approved numerical criteria, and outstanding upper-level limitations are
not converted into clinical evidence by this implementation. This note describes
branch code, not deployed functionality or clinician-verified outcomes.

After CI, verify same-commit job results separately. Staging ownership/RLS,
physical-device audio, live aphasic understanding, clinician review and
hospital readiness remain outside the synthetic software regression boundary.
