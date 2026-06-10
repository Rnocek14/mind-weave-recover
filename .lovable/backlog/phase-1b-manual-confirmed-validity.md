# Phase 1B — Manual-Confirmed-Correct Trials Excluded From Scoring (IMPLEMENTED)

Status: IMPLEMENTED (2026-06-10). Approved taxonomy shipped; manual confirmation no longer mislabeled no_response.
Owner: TBD

## What shipped
- `validity_label = 'manual_confirmed'` added to `classifyUtteranceValidity` (no DB enum constraint; additive).
- New input metadata: `manualConfirmed`, `confirmedBy` ('user'|'caregiver'), `asrVerified`, `confirmationMode`.
- `ValidityResult` now carries three scoring axes: `countsTowardScore` (ASR/independent — false for manual),
  `countsTowardParticipation` (true for manual), `countsTowardPracticeAccuracy` (true for manual) + `confirmedBy`.
- `applyValidityGate` exposes `shouldCountParticipation` / `shouldCountPracticeAccuracy` / `shouldCountAsrAccuracy`
  + `confirmedBy`, bucket `'manual'`. `shouldFeedAdaptation` stays false for manual (no adaptation drift).
- `useExerciseTelemetry` stamps the new axes into `engagement_flags` + `speech_validity`; `validity_label='manual_confirmed'`,
  `counts_toward_score=false`.
- `sessionAccuracySummary` reducer: `accuracy`/`asr_accuracy`/`independent_accuracy`/`cue_assisted_accuracy` stay ASR-clean;
  added `practice_accuracy` (includes manual), `manual_confirmed_trials`, `participation_trials`. Shared
  `accuracySummaryToSummaryFields()` used by all three session-end writers (sessionTracking, useSessionLifecycle, PhotoNamingExercise).
- Plumbing: PhotoNaming caregiver "Said it" → `manualConfirmed:true, confirmedBy:'caregiver'`; exercise page forwards to classifier
  + stores provenance in task_parameters (confirmation_mode/confirmed_by/manual_confirmed/asr_verified). profile_id plumbing unchanged (Fix 2).
- UI: ExcludedClipsAudit labels manual_confirmed as "Manually confirmed" (muted, not a failure).
- Tests: classifier (no_response vs manual_confirmed), gate axes, reducer (clean vs practice vs participation).

Guardrails honored: no adaptation/progression threshold changes, no scoring-rule changes, additive only, no historical backfill.

---

## (Original investigation notes)

Severity: High — affects severe aphasia and real-world mic/ASR failures.
Relationship to Phase 1: Phase 1 logging-correctness fixes remain COMPLETE. This is a follow-up correctness gap, not a regression of Phase 1.

## Issue
Photo Naming (and any speech game using the manual "I Said It" / self-confirm path) can record `score=100`
via manual confirmation, but the Speech Validity Gate assigns `validity_label=no_response` and
`counts_toward_score=false` because the whisper/browser transcript is missing or empty. The accuracy
reducer (`reduceAccuracy` in `src/lib/sessionAccuracySummary.ts`) correctly excludes
`counts_toward_score=false` rows, so `summary.accuracy` stays `null` even though the user completed
correct trials.

Net effect: legitimate practice by users who rely on manual confirmation (mic/ASR failure, hard-to-transcribe
aphasic speech) is invisible to plateau/regression detectors and clinician analytics.

## Findings (read-only investigation)

1. **Where score=100 / correct is set for manual confirmation**
   - `src/components/PhotoNamingGame.tsx`
     - Caregiver-assist mode: `handleCaregiverResponse('said_roughly')` → `correct = true`,
       `logFinalAnalysis({ transcriptSource: 'manual', ... })` (~line 2501).
     - Patient self-confirm / mic-lock recovery path around `processStableTranscript` (~line 776) and the
       `transcriptSource: whisperTranscript ? 'whisper' : 'browser'` branches (lines 1773, 2279).
   - The `result` object passed up to the exercise page does NOT currently carry an explicit
     "this was manually confirmed" flag (only `transcriptSource` exists inside the game's own logger call).

2. **Where validity_label is assigned**
   - `src/pages/PhotoNamingExercise.tsx` (~line 506) calls `classifyUtteranceValidity({ transcript, asrConfidence, recordingDurationMs, acousticMetrics })`
     BEFORE `submitTrial`. With empty transcript + short/absent duration → `no_response`.
   - `src/lib/clinical/classifyUtteranceValidity.ts` — pure heuristic. Rule #1: empty transcript OR
     `durationMs < 400` ⇒ `no_response` (`countsTowardScore=false`). It has no concept of manual confirmation.
   - `src/lib/clinical/applyValidityGate.ts` — maps only `valid_attempt` to `shouldScore=true`.
   - `src/hooks/useExerciseTelemetry.ts` (~lines 285-316) — stamps `validity_label`, `counts_toward_score`
     onto `exercise_events` from the gate decision; when no validity is supplied it defaults
     `counts_toward_score=true`.

3. **Should manual confirmation produce a distinct label?** Yes — recommended `manual_confirmed`
   (a.k.a. `user_confirmed` / `non_asr_valid`). It must NOT be folded into `valid_attempt`.

4. **Should counts_toward_score be true for manual-confirmed?** Partially — see recommendation. Needs a
   second axis so "counts for participation/practice" ≠ "counts as ASR-verified speech".

5. **Distinguishing manual-confirmed from ASR-verified** requires plumbing a `transcriptSource`/`confirmationMode`
   signal ('asr' | 'manual' | 'caregiver') from the game `result` into `classifyUtteranceValidity` /
   `submitTrial`. Today that signal is dropped at the exercise-page boundary.

6. **Clinician dashboards** should label these separately (do not show manual-confirmed inside ASR-verified
   accuracy). Session Review already buckets by validity, so a new bucket slots in cleanly.

## Recommendation (decide before implementing)

Do NOT treat manual-confirmed as equivalent to ASR-confirmed.

- Add validity label `manual_confirmed` (Phase 1B), emitted only when the trial was explicitly confirmed by
  the user/caregiver without a scorable transcript.
- Split scoring into two axes instead of the single `counts_toward_score`:
  - `counts_toward_participation` = true for manual_confirmed (session completion / dose / engagement).
  - `counts_toward_practice_accuracy` = true (optional, configurable) — coarse "practice accuracy".
  - `counts_toward_asr_accuracy` = FALSE for manual_confirmed — keep ASR-verified accuracy clean.
- Keep `summary.independent_accuracy` = ASR-verified, cue_level 0 only. Manual-confirmed never enters it.
- Plumb `transcriptSource`/`confirmationMode` from the game `result` → exercise page → `classifyUtteranceValidity`
  so the classifier can branch instead of mislabeling as `no_response`.
- Clinician analytics should distinguish: ASR-verified correct, manual-confirmed correct, cue-assisted correct,
  no response, unclear/low-confidence, ASR-failed.

### Proposed final taxonomy
| Category | validity_label | participation | practice acc | ASR acc |
|---|---|---|---|---|
| ASR verified correct | valid_attempt | ✓ | ✓ | ✓ |
| Manual confirmed correct | manual_confirmed | ✓ | ✓ (opt) | ✗ |
| Cue-assisted correct | valid_attempt (cue_level>0) | ✓ | ✓ | independent=✗ |
| No response | no_response | ✗ | ✗ | ✗ |
| Unclear / low confidence | low_confidence | ✗ | ✗ | ✗ |
| ASR failed (but effort) | (new) asr_failed | ✓ | ? | ✗ |

## Scope guardrails when implemented
- Logging-correctness + taxonomy only. Do NOT change adaptation/progression thresholds or scoring rules.
- Preserve existing data; additive columns/labels only.
- Add migration + types + tests + verification report.
