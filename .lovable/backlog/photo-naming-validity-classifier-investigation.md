# Investigation: Photo Naming validity classifier mislabels correct trials

Status: RESOLVED 2026-09-01 — root cause confirmed and fixed (see Resolution)
Severity: MED–HIGH (clinical signal quality)

## Resolution (2026-09-01)

Two confirmed root causes, both in the gate's inputs — the classifier's
thresholds were untouched, per the checklist below:

1. **Unknown duration collapsed to 0ms.** `PhotoNamingGame` only measures
   `recordingDurationMs` when a MediaRecorder session was active
   (`isRecording && user && activeSessionId`). A fast browser (Web Speech)
   recognition with no recording reported `undefined`, which
   `classifyUtteranceValidity` coerced to `0` — tripping the `< 400ms`
   no_response rule against a trial the scorer marked correct. Fix: the
   classifier now distinguishes *unknown* duration from *measured-short*;
   only a measured sub-400ms clip is rejected on duration
   (`src/lib/clinical/classifyUtteranceValidity.ts`).
2. **Gate transcript narrower than scorer transcript.** The gate read
   `whisperTranscript || browserTranscript` while the scoring path also had
   the unified `utteranceAnalysis.transcript`. When both ASR fields were
   empty but analysis transcribed the speech, the gate stamped
   background_noise/no_response. Fix: the call-site fallback chain now ends
   with `utteranceAnalysis?.transcript`
   (`src/pages/PhotoNamingExercise.tsx`). That field is only ever the raw
   whisper transcript or empty — never back-filled with the target — so
   silence cannot be rescued into a scored attempt.

Covered by new cases in `classifyUtteranceValidity.test.ts` and
`photoNamingValidityReconciliation.test.ts` (unknown-duration rescue,
analysis-transcript rescue, and silence-not-rescued guards).

## Symptom
On Photo Naming sessions, correct spoken trials are scored as 100 but the
speech validity gate stamps `validity_label = no_response` / `background_noise`
and `counts_toward_score = false`. Result: session summary `scored_trials = 0`
and accuracy fields (`accuracy`, `asr_accuracy`, `independent_accuracy`,
`cue_assisted_accuracy`, `practice_accuracy`) come back null even though the
patient answered correctly.

## Why this is NOT bundled with #1/#3
#1 (`adaptation_events.profile_id`) and #3 (duplicate empty sessions) are pure
data-plumbing fixes. This is clinical signal quality — touching it means
changing the validity classifier / scoring path, which is explicitly out of
scope for the data-integrity pass.

## Investigation checklist (do BEFORE changing any logic)
1. ASR capture — is audio actually reaching the recognizer on Photo Naming?
   Compare against Pattern Match (which scores fine).
2. Transcript source — which transcript field feeds the validity gate vs the
   scorer? A mismatch (scorer sees text, gate sees empty) would explain
   score=100 + label=no_response.
3. Acoustic gate — confirm the background_noise / no_response thresholds and
   what acoustic features they read; check for an empty/missing feature vector.
4. Classifier thresholds — review confidence cutoffs and whether a low-confidence
   default is silently set to `no_response`.

## Do NOT
- Do not change validity labels, scoring, adaptation/progression thresholds,
  or UX until the root cause above is confirmed.
