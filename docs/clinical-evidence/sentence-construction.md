# Sentence Construction — Clinical Evidence and Implementation

## Status: Structural eight-level grammar ladder (review branch)

The patient’s saved Clinical Level (1–8) now selects a **specific syntax cohort** from the real sentence bank. The separately displayed 1–10 in-game difficulty may adapt within the assigned cohort but cannot silently substitute a different grammar stage.

| Clinical level | Content | Bank difficulty | Runtime mode |
| --- | --- | --- | --- |
| 1 | Basic subject–verb–object sentences | 1 | Word tiles + heard model |
| 2 | Expanded SVO, articles and prepositions | 2 | Word tiles + heard model |
| 3 | Subject–verb agreement | 3 | Words provided; no automatic model |
| 4 | Complex word order and verb tense | 4–5 | Words provided |
| 5 | Coordinating conjunctions (and/but/or) | 6 | Words provided |
| 6 | Subordinating conjunctions (because/when/although) | 7 | Words provided |
| 7 | Relative clauses (who/that/which) | 8 | Words provided |
| 8 | Multi-clause, conditional and passive constructions | 9–10 | Words provided |

**Important limit:** Even when voice is used, the game still exposes its word options. The L8 content is now *implemented for constrained sentence ordering*, not open spontaneous sentence formulation. No clinician-facing output should claim the latter. L6–L8 remain **thin** because the bank and error analysis require clinical review; presence of samples is not evidence of clinical validation.

## Clinical rationale

Mapping Therapy (thematic roles), Treatment of Underlying Forms (TUF), and Verb Network Strengthening Treatment (VNeST) motivate structured grammar practice with graded scaffolding. This particular eight-stage order and advancement thresholds are **engineering calibration defaults**, not a clinically established ranking of treatment approaches. In particular, TUF can deliberately train complex forms first, so the hierarchy should not be portrayed as universally optimal.

## Assistance and trial integrity

- When a model sentence is automatically read or manually replayed, `hintUsed` is recorded and the attempt uses `highlight_plus_choice` rather than `choice_based`.
- Higher levels do not automatically read the full answer before patient tries.
- Recognized speech is scored from the current transcript, not a not-yet-committed tile-state update.
- Actual sentence-bank difficulty and grammar focus are reported separately from the engine’s in-session difficulty; model support and response mode still need observational validation.
- The persisted level advances only through the existing shared evidence/mastery rules after session completion. A mocked check does not establish live patient scoring or Supabase durability.

## Saved progression safety

The patient-specific progression hook now uses `loadProgressionStateChecked`. A real database read returning no row is a **new Level 1 profile**, but a failed/RLS-rejected read is **not** equivalent to a new profile. Patients can still practice the basic syntax level when a read fails or no profile exists; those unverified attempts cannot write a replacement `clinical_progression_state` row. This prevents a transient connection problem from resetting a learner with established progress.

Clinical trials and the subsequent session flush are scoped to the current user/profile identity. Switching patients discards pending progression trials and hides the previous patient's displayed level. Repeated session completion cannot duplicate a successful progression flush. A failed save retains its buffered evidence for a retry. These are application-level protections; database conflict prevention, row ownership, verified transaction durability and account access still require isolated authenticated tests. The protected read does not change grammar targets, advancement thresholds, or cue weighting.

The bank integrity regression now checks that each constrained syntax stimulus has all the tiles required to assemble its canonical answer, including repeated words, and that its documented advanced grammar cohorts are actually present. This is a content-structure check, **not** a speech-language pathologist's judgment of clinical appropriateness.

## Clinical and technical checks before rollout

SLP reviews content for word frequency, appropriateness, sentence structure and patient accessibility. Perform real-device speech tests (including aphasic speech, background noise and self-captured TTS), isolated authenticated database write/read tests, and a no-regression rehearsal for the complete game/session lifecycle. Do not merge solely on the basis of synthetic unit tests.
