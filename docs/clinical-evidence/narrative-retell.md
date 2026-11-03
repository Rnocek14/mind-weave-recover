# Narrative Retell — Clinical Evidence and Implementation

## Status: Structural fact-recall ladder (review branch)

Narrative Retell now loads a saved 1–8 clinical level and pins the story content for the session. Early levels are **not** the old 4–6-event stories with an artificially reduced scoring threshold; they are genuinely short listening tasks written for adults.

| Level | Patient hears | Target being scored |
| --- | --- | --- |
| 1 | One short event | One key fact; one word or phrase may be sufficient |
| 2 | Two short events | Two distinct key facts |
| 3 | Three short events | Three distinct key facts |
| 4 | Short everyday narrative | Four key events |
| 5 | Episodic narrative | Four key events from a more complex story |
| 6 | Episodic narrative | Five key events |
| 7 | Inferential narrative | Five key events |
| 8 | Inferential narrative | Six key events |

There are **18 adult scenarios × 3 short versions = 54 micro-recall stories** at L1–L3, and the original narrative bank remains available at L4–L8.

**What is actually scored:** lexical/semantic matches to key concepts (main-fact coverage) using the existing `scoreExplanation` proxy. At L1–L3 a single meaningful word can be scored. A two-fact task cannot be passed by correctly recalling only one fact. Story chronology, perspective, coherence, full story grammar, and conversational transfer are **not** clinically measured; these thresholds are not yet validated. The original aspirational macrostructure designs remain in `narrativeRetellLevels.ts`; the review branch has not implemented their specialized scoring.

## Clinical rationale

Discourse analysis in aphasia (including work by Ulatowska, Wright and Capilouto), story grammar and main-concept analysis, and script training inform the desired direction. But the implemented one-/two-/three-fact prerequisite and 8-stage numeric thresholds are **clinically motivated engineering defaults**, not validated outcome measures. More complex stages remain **thin** until content/assessment is checked by SLPs.

## Input, cue and persistence integrity

- All coaching modes retain story audio and visible content in the reading phase, plus speech/typing fallback and a retry button.
- The lower stages permit short responses without broadly weakening the shared multi-game `retell` response gate.
- The game records whether a response was spoken, typed or skipped, whether the gate passed, and whether help/replay was used.
- Typed practice remains valid **practice**, but cannot be counted as evidence of **spoken expressive** gains. Skips/invalid ASR/failed raw-event writes do not advance the persistent spoken level.
- The persisted level is only updated after the end-of-session raw-event writes settle; saved state is scoped by patient profile.
- The clinician-facing /games registry labels this a structural ladder, not a diagnosis or proven speech-outcome measure.
- The shared mastery layer is **not** reclassified: Narrative Retell remains outside `ADOPTED_TRIAL_MODE_SLUGS`; it retains its existing telemetry writer.

## Verification required before production

Test microphone/real-device voice and TTS interruption, aphasic and semantically correct paraphrases, false positives (e.g., repeating a target word heard aloud), typed fallback, retries, profile switching, read/write/RLS persistence in an isolated staging backend, clinical content approval and cross-session level behavior. Automated synthetic test success alone does not establish efficacy.
