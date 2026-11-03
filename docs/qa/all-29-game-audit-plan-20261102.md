# NeuroSpark — every-game readiness audit (November 2, 2026)

**Status: audit coverage implemented on a draft branch; 29 game completions NOT verified.**
This file is a work plan and evidence ledger, not a certificate of game quality,
clinical validity, deployment, or test execution. The source of truth for current
implementation is the named candidate revision, not historical descriptions.

## What is being audited

- The default-branch canonical registry contains **28 exercise slugs**; the separately
  routed **Functional Command Scenes** activity brings the full audit scope to **29**.
- Previous `src/data/qaScenarios.ts` specified **14 wired** and **3 aspirational**
  per-game scenarios. That was **17** named games, not a complete patient library audit.
- The QA runbook now derives one independent scenario from each canonical entry and
  adds the supplemental activity explicitly. It covers **29/29 audit scenarios** with
  **12 required checks per activity**. Inclusion is not evidence of passing.
- The prior 17 generic scenarios did not verify per-game level 1 versus 8,
  response-input attribution, one-to-one trial write/read-back, or reliable rescue
  from patient failure and loss of microphone. The expanded checks now require these
  observations or an explicit failure/unverified result.

## Separate gameplay, clinical progression, and validation

The open [29-game completion epic](https://github.com/Rnocek14/mind-weave-recover/issues/103)
tracks **13 persisted clinical ladders** and **16 design-only ladders**. Even within
the 13, some higher levels have content, scoring or review limitations. Eight-stage
*practice* gameplay is distinct from an eight-stage *clinical mastery* system.

The November 2 stacked draft PRs [#125](https://github.com/Rnocek14/mind-weave-recover/pull/125)
through [#128](https://github.com/Rnocek14/mind-weave-recover/pull/128) add
practice capabilities in waves. Draft [#129](https://github.com/Rnocek14/mind-weave-recover/pull/129)
and [#130](https://github.com/Rnocek14/mind-weave-recover/pull/130)
are **sibling** work on top of #128; do not merge them as a naïve linear chain.
Their PR bodies estimate up to **12/29** staged practice activities **only after
proper integration**. They do not validate all 29 games, the upper clinical
levels, real aphasic recognition, RLS, or hospital readiness. All referenced PRs
were open/draft at the start of this audit; check actual status again before integration.

## Target acceptance for each game

1. **Purpose and real activity**: locate it in the Practice library, start
   the intended player, confirm no fallback placeholder, and check that the
   actual trial exercises the stated functional skill.
2. **Stage-by-stage reality**: observe distinct stage 1 and 8 runtime
   tasks. Later verify all intervening stages, sufficient fresh authored content
   and appropriate challenge. An authored design spec alone is **not** a pass.
3. **Response provenance**: capture objective actions, valid answers and
   plausible alternatives without falsely grading uncertain ASR; keep spoken,
   typed, tap/choice, supported/modelled, and skipped attempts distinct.
4. **Support without punishment**: repeat TTS, give contextual cues, reveal
   or model when appropriate; allow pause, skip and rescue without loops, time
   pressure by default, or celebration of a missed answer.
5. **Correct evidence**: exactly one owned raw event per trial with identity,
   stimulus, response, assistance, input mode and uncertainty. Save failure
   blocks verified completion and automatic mastery changes. Verify the stored
   row and summary against each other in an **isolated** backend.
6. **Resilience**: exit, reload/resume, double-click, mic denial, late
   transcript, stale recording, TTS overlap, small screens and large text.
   Confirm that an exited game no longer records mic/audio or advancements.
7. **Longitudinal separation**: only clinician-approved, actually implemented
   per-game progression criteria can count toward independent mastery.
   Staged practice and time-on-task are not by themselves evidence of recovery.
8. **Functional transfer**: where clinically appropriate, use held-out
   prompts and structured, supported daily-life communication to evaluate
   generalization **separately** from trained game performance.

## Next implementation waves (clinical changes are NOT authorized here)

| Wave | Target | Review gate |
| --- | --- | --- |
| 0 | Reconcile stacked/overlapping draft branches and establish one candidate SHA | Full regression CI on that SHA; inspect diff, avoid duplicate integrations |
| 1 | Verify and correct core functional games: Photo Naming, Phrase Practice, Describe & Guess, Thought Continuation, Narrative Retell, Conversation Coach/Partner | Patient flow, speech provenance, anti-loop, no invented mastery |
| 2 | Validate lexical/semantic and sentence games: Two Clues, Meaning Match, Category Fluency, Fix Sentence, Semantic Features, Synonym Generator, Sentence Construction, Word Finding, Sentence Game | Per-game answer rubrics, alternatives, cues, untrained probes |
| 3 | Validate attention, comprehension, executive, and motor games, including Pattern Match, Follow Directions, Sequence Builder, Thought Organization, Functional Scenes, Reach & Tap, Left-Side Hunt, Detective Mind, Planning, Dual Load, Minimal Pairs and Phonological Awareness | Receptive/expressive/motor domains not conflated; device/vision safeguards |
| 4 | Test each game as part of guided sessions and verify accurate clinician/caregiver reports | Isolated authenticated read-back, two-account access denial, same-revision backend |
| 5 | Clinician review, representative aphasic audio, physical iOS/Android and pilot safety validation | [Hospital pilot blockers #117](https://github.com/Rnocek14/mind-weave-recover/issues/117) all resolved |

## How to use the audit

1. On the same candidate revision, open the admin-only `/dev/qa-runbook`.
2. Filter `Area: game`. Test all 29 scenarios on a properly isolated
   test installation. Keep roles, device, exact build SHA, and test notes.
3. Record **Pass** only for an observed result, **Fail** for unmet requirements,
   and **Skip** with reason for any path not tested. Do not use missing data
   or blocked environments to infer a pass.
4. Export the results; file defects with stimulus, game slug/stage, input mode,
   expected vs actual, save/read-back evidence and reproduction steps.
5. Add production-function regression tests before/with each fix. Rerun
   the relevant `bun run qa` gate and `bun run qa:release` on isolated
   services when candidate and environment allow it. A green `qa` gate
   does **not** mean the per-game manual runbook has been executed.
6. Stop deployment or clinical promotion if a test finds invented score,
   incorrectly attributed voice, missing results, denied access failure,
   or a patient-facing dead end.

## Verification limitations

This branch only expands a **manual audit harness and its unit coverage**.
It does not make any of the 29 games newly playable, implement more clinical
levels, change existing responses/scores, or touch production patient data.
Production readiness requires observed tests plus discipline-specific clinical
review. Never represent a checklist as a completed test run.
