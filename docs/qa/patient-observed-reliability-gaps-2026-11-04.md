# Patient-observed NeuroSpark regression gaps — 2026-11-04

**Status: release-blocking acceptance work, not a declaration of clinical readiness.**  
**Reference:** first-hand family/patient observations from 2026-11-04.  
**Environment for patient tests:** isolated synthetic staging backend, with separate real-device validation; never record patient audio in GitHub or CI artifacts.

## Why green CI failed to protect these sessions

The existing speech Playwright suite mainly exercises Photo Naming with a synthetic microphone and controlled recognition/analysis responses. A passing synthetic WAV capture proves transport and UI transitions in its fixture, **not** actual Safari recognition of atypical or pause-heavy speech or the Two Clues / Describe & Guess / Finish the Thought component state machines. Unit tests can prove a scoring rule while the speech candidate extractor, microphone lifecycle or saved result remains broken. The manual /dev/qa-runbook previously covered these games mostly through generic steps rather than the reported field journeys.

The failures are **both** patient-usability failures (mic off; prompts hidden; over-rapid feedback) and potential measurement-integrity failures (clue repetition counted as incorrect, a valid alternative rejected, unverified audio treated as a scored response). Do not conflate them.

## Field observations, reproducible boundaries, and existing draft work

| Patient-reported behavior | Required evidence | Existing relevant PR (as of 2026-11-04) |
| --- | --- | --- |
| Two Clues: `holds / water`; patient said `cup` but game rejected it | Recorded transcript -> production candidate extractor -> acceptance tier -> one persisted attempt and progression outcome | [#152](https://github.com/Rnocek14/mind-weave-recover/pull/152) (draft) |
| Two Clues: speaking/repeating clue words while thinking prompts premature scoring; `keeps / secret` clue too abstract | Pauses, rehearsals, multi-segment speech and alternate answers do not cause false failures; confusing content quarantined pending SLP review | [#152](https://github.com/Rnocek14/mind-weave-recover/pull/152) (draft) |
| Describe & Guess: first card listens, second card microphone becomes unavailable | Full real-component two-card journey, failed start/retry, stale TTS promise, fresh transcript and isolated saved attempts | [#151](https://github.com/Rnocek14/mind-weave-recover/pull/151) and [#153](https://github.com/Rnocek14/mind-weave-recover/pull/153) (separate drafts touching same component) |
| Describe & Guess: full description questions hidden/too subtle | Full questions immediately visible on the actual phone; prompts remain distinct from spoken feature production and requested cues | [#153](https://github.com/Rnocek14/mind-weave-recover/pull/153) (draft) |
| Finish the Thought: ~2-second pause wrongly signals completed sentence | Continued speech after 2, 5 and 8 seconds stays in the same answer; trailing connectors do not auto-commit; no duplicate outcome | [#155](https://github.com/Rnocek14/mind-weave-recover/pull/155) (draft) |
| Minimal Pairs: spoken echo not properly analyzed or attributed | Spoken-echo audio and pronunciation processing proven separately from recognition choices; unavailable values remain missing | [#150](https://github.com/Rnocek14/mind-weave-recover/pull/150) (closed; confirm deployed revision) |

**Critical integration point:** independent green CI results on #151, #152, #153 and #155 do not test their combined behavior. #151 and #153 overlap on `DescribeGuessGame.tsx`. No release claim is justified until a *single final integration SHA* and its matching backend pass together.

## Tests to automate — behavior, not pass count

1. **Game-real-component Playwright/RTL journeys.** For each enabled voice game, run 3+ consecutive trials (correct, repeated prompt, uncertain, wrong, skip, patient retry, hint), assert actual mic state, no wrong-trial callbacks, and exactly one saved event per accepted answer. Include both fresh entry and lesson-to-game transitions. Use real production components and state machines; mock only clearly declared external provider transport.
2. **Pause-heavy transcript scenarios.** Feed final and interim recognition events with 2 s, 5 s, 8 s and longer spoken continuations; include fillers, self-corrections, prompt echoes, paraphrases and stuttering. Prove no scoring before the task-specific turn-ending criterion and no deadlock forever. Preserve raw audio/ASR evidence independently from task answer extraction.
3. **Fair answer evaluation.** Curate positive, negative and ambiguous *gold* sets, reviewed with an SLP. Run them through real production interpreters AND the game UI. More than one answer can be defensible; uncertain/non-recognized speech must not become a measured patient error. Treat clinical thresholds as calibration hypotheses, not validated constants.
4. **Two-way microphone handoff.** For each trial boundary and transition, simulate TTS still playing, delayed permission, recognition failure, duplicate `onend`, stale async callbacks, rapid skip/retry, app background/foreground, and Bluetooth route changes. Assert no capture of Maya's speech and a conspicuous recovery action when the mic stays off.
5. **Truthful measurements.** Trace representative speech from recognition and analysis through `utterance_analyses`, `exercise_events`, clinical progression, and caregiver/clinician summaries using an isolated backend. Compare the same attempt IDs and evidence type. Missing audio or doubtful recognition is unavailable/uncertain, never fabricated low performance.
6. **Visual/patient accessibility.** Mobile portrait tests must assert the instructional question is understandable without searching, text is legible with the image and controls visible, spoken instructions have replay, and the user can finish or recover without typing. A screenshot or DOM-presence assertion alone is insufficient; patient/caregiver usability sign-off is a separate requirement.
7. **Cross-game and session boundaries.** Run a complete guided session with mixed voice and non-voice games, coach transfer, pause/resume and logout, with completed session rows reconciled to summaries. Repeat with a patient profile requiring slower pacing.

Each new field report should produce **a red test on the defective revision, a green test on the fixed revision, and a real-device acceptance record** wherever feasible. Tests must assert specific clinical-data invariants rather than implementation text or constant values alone.

## Release-quality gates and evidence

| Gate | Pass evidence | What it does NOT prove |
| --- | --- | --- |
| Unit + RTL (real component) | Suite name, revision, pass/fail/skip, mock boundaries | Safari mic, real aphasic ASR, persistence |
| Public Playwright + synthetic mic | Recorded multi-trial cases with controlled recognition and audio transport | Live provider semantics, authenticated backend |
| Isolated `bun run qa:release` | Same-candidate front-end/backend, authenticated DB read-back and deployed speech smoke | Clinical efficacy, real iPhone audio |
| Physical device acceptance | iPhone/Safari and Android/Chrome patient-paced journeys above, with version, device, outcome and observed state | Every aphasia/impairment phenotype |
| SLP/caregiver review | Accepted synonyms/ambiguities, cue taxonomy, accessibility, and risk sign-off | Regulatory approval or measured outcome improvement |
| Deployment control | Main protection and *all* deployment paths gated to the verified revision, rollback rehearsed | A guarantee of zero remaining bugs |

**No hospital pilot readiness** until failed/blocked critical journeys are resolved or expressly bounded with approved mitigations. If a release gate skips a required journey, report NOT VERIFIED, never PASS. Verify the actual public build/revision; a passing open draft is not automatically live.

## In-app field test scripts

The runnable **manual QA scenarios** are in `src/data/qaScenarios.ts`:
- `patient-repro-two-clues-rehearsal`
- `patient-repro-describe-guess-handoff`
- `patient-repro-finish-thought-pauses`
- `patient-repro-minimal-pairs-echo`

Record each individual step as PASS, FAIL or SKIP in `/dev/qa-runbook` on an **isolated** app. These scripts are **not** automation and are **not claimed to have been performed** by adding them to source control.

## Immediate integration order

1. Preserve the observed symptoms and collect exact version/browser/session trace (consented, redacted); mark affected game telemetry uncertain if the speech pipeline may have fabricated a failure.
2. Confirm the baseline red checks against defective code. Keep #151 and #153 mic/prompt changes and tests together in the integration candidate, resolving their overlapping component changes explicitly.
3. Integrate and verify the corrected #152 Two Clues answer/timing contract and #155 Finish the Thought pacing contract. Retain all regressions in the same final candidate and evaluate nearby speech games for shared side effects.
4. Run full `bun run qa` and `bun run qa:release` on the same release SHA/backend, then a real iPhone and Android patient walkthrough. Inspect skipped tests and actual live metrics end-to-end.
5. Activate repository rule protections and equivalent Lovable/manual deployment restrictions. A green draft PR, file listing or release checklist alone does not prevent unsafe deployment.
6. Only then decide whether a limited home/clinician pilot is appropriate; outcome/clinical claims still require independent clinical validation.

### Scope boundary

The new work in this QA branch adds an answer-graph/extraction unit contract, manual patient-journey scripts, and this review. It does not modify scoring, adaptation, production microphone logic, clinician-facing outcomes or production patient data. Existing targeted draft fixes must be separately tested and integrated; no live device checks have been conducted here.
