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

Mapping Therapy (thematic roles), Treatment of Underlying Forms (TUF), and Verb Network Strengthening Treatment (VNeST) motivate structured grammar practice with graded scaffolding. This particular eight-stage order and advancement thresholds are **engineering calibration defaults**, not a validated rank ordering of treatment approaches. In particular, TUF can deliberately train complex forms first, so the hierarchy should not be portrayed as universally optimal.

## Assistance and trial integrity

- When a model sentence is automatically read or manually replayed, `hintUsed` is recorded and the attempt uses `highlight_plus_choice` rather than `choice_based`.
- Higher levels do not automatically read the full answer before patient tries.
- Recognized speech is scored from the current transcript, not a not-yet-committed tile-state update.
- Actual sentence-bank difficulty and grammar focus are reported separately from the engine’s in-session difficulty; model support and response mode still need observational validation.
- The persisted level advances only through the existing shared evidence/mastery rules after session completion. A mocked check does not establish live patient scoring or Supabase durability.

## Clinical and technical checks before rollout

SLP reviews content for word frequency, appropriateness, sentence structure and patient accessibility. Perform real-device speech tests (including aphasic speech, background noise and self-captured TTS), isolated authenticated database write/read tests, and a no-regression rehearsal for the complete game/session lifecycle. Do not merge solely on the basis of synthetic unit tests.
