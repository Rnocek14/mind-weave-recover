# Response-time reporting verification

This follow-up corrects the timing mismatch documented in the speech regression
work at `f12bc916969bcbca9bf04d429f99f4e5fac7a72f`. It separates accepted-answer
timing from upload/analysis completion and prevents historical diagnostic
durations from being presented as patient response measurements.

## Measurement contract

For normal accepted Photo Naming answers, the game already captures
`reactionTime` before it stops the recorder, uploads audio, or waits for
analysis. That existing value is now carried through the captured attempt as:

```json
{
  "responseTiming": {
    "version": 1,
    "basis": "trial_start_to_answer_acceptance",
    "elapsedMs": 2400
  }
}
```

It is stored inside the existing `audio_meta` JSON field. Provider provenance
and recording diagnostics are preserved. No database column or migration is
introduced. The historical `latency_ms` field retains its existing meaning as
time until analysis finalization; it is not reused for patient response time.

The measured interval starts at the game's existing trial start marker and ends
when the application accepts the spoken or tapped answer. It includes local
recognition and end-of-speech handling. It is **not** speech-onset time, a pure
physiological reaction-time measurement, recording duration, or a clinical
measure of recovery. Scoring, progression, cues, timeout durations, and existing
decision thresholds are unchanged.

Timeout, skipped, caregiver-observed, and manual-confirmation flows do not gain
an accepted-answer measurement from this change. Other games that do not yet
provide the explicit contract retain unavailable utterance response timing.

## Read and display rules

`src/lib/speech/responseTiming.ts` validates the exact version, basis, numeric
type, and finite nonnegative duration. Measured zero remains zero. Unknown
versions, another timing definition, strings, negative values, non-finite
values, or absent metadata remain unavailable.

For utterance rows, consumers never fall back to `latency_ms`, recording length,
first-word latency, timestamp subtraction, or an estimated provider delay.
Existing event/adaptation-log `reaction_time_ms` fields remain separately
validated sources. Existing historical rows are neither rewritten nor
backfilled.

The affected history/detail hooks expose the validated value separately. Their
consumers use only measured values for averages and preserve an unavailable
result when none exist. A genuine zero is shown and included in the denominator.
History CSV exports leave unavailable averages blank. Voice Evidence uses
measured answer timing when selecting a fastest clip and removes that claim
when the timing evidence is absent. Capability/response-time observations use
the same validated source while preserving their existing thresholds.

Affected consumers include session history, its timeline and CSV export,
session detail/review, the Voice Evidence grid, across-time audio review, and
the capability/speech correlation hook.

## Reproduced failures

- The actual logger's new tests failed three cases before the fix: missing
  accepted-answer timing after delayed finalization, missing measured zero,
  and missing frozen timing across a failed-write retry. Eight missing/invalid
  input controls already passed.
- Actual history/detail/correlation hooks and the session-insight function
  failed eight cases before their correction, with six passing controls. A
  2,400 ms response appeared as 90,000 ms, and synthetic service-completion
  durations produced a false 65-second response-time recommendation.
- Twelve UI regressions initially produced eleven failures and one passing
  validity/recording-quality control. They exposed incorrect means, missing
  values exported as zero, and clip selection by service speed.
- The real-game delayed-analysis browser assertion failed before the game
  supplied the explicit measurement. The observed response was 2,877 ms while
  the controlled service hold lasted 7,306 ms and the old diagnostic duration
  was 10,307 ms.

After the producer/logger correction, the complete eleven-case speech browser
suite passed without skips or retries. In that run the first answer's callback
and persisted response measurement both remained 2,923 ms despite a 7,308 ms
analysis hold; the independent diagnostic duration was 10,313 ms. The later
answer retained its own 2,851 ms response measurement and original identity.

## Commands and verification boundaries

Latest local results on 2026-10-28:

| Check | Result |
|---|---|
| Focused response-time command | 54 passed across five files; zero failures or skips. |
| Full unit/hook/component suite | 2,087 passed across 162 files; 25 existing skips; zero failures. |
| Environment/result/service/worker guard checks | 44 passed; zero failures or skips. |
| Public Chromium and mobile WebKit journeys | 38 passed; zero skips, retries, or flaky results. |
| Speech browser journeys | 11 passed; zero skips, retries, or flaky results. |
| App, build-config, E2E, and speech-harness typing | Passed. |
| Lint | Zero errors; 1,217 warnings remain. |
| Complete `bun run qa` command | Passed. |

```bash
bun run test:response-timing
bun run test:speech
bun run test:e2e:speech
bun run qa
```

The focused command runs the actual timing validator, logger, readers/domain
logic, and UI consumers. It is also included in speech/full unit verification.
The browser case uses real Chromium capture and production game/logger code
with controlled recognition events and HTTP responses. Unit/hook/component
tests replace database transport. These results do not establish live database
persistence, access policies, native recognition quality, or physical-device
behavior.

## Isolated backend status

### Native local follow-up — 2026-10-28

The subsequent [isolated database verification](./isolated-database-verification.md)
applied all 171 migrations to a disposable native Supabase instance. After
correcting the fresh-user test to complete the actual Welcome UI, the complete
authenticated suite passed 14 cases with zero failures, skips, unrun cases,
retries, or flakes. Its first run's 12 passes and two onboarding-fixture failures
are retained in that report.

Both browser core-loop cases now read back each of three accepted chip answers
through the real local database. They require exact attempt/trial/session/user
mapping, the versioned response-timing metadata, equality with the event's
`reaction_time_ms`, and unchanged selected fields after reload. This establishes
local persistence of the tested accepted-tap timing contract. It does not
establish Azure speech behavior or physical-device timing.

A separate public clinician-route test now waits for its existing auth-gate
condition. Five repeated WebKit checks and the complete 38-case public suite
passed without retries. That readiness correction changes no application
permission or authentication behavior.

### Hosted access and speech services

The connected Supabase account lists projects but cannot access NeuroSpark's
known project or its development branches. No hosted isolated endpoint or Azure
Speech configuration is available in this runtime. Management access to hosted
speech secrets is therefore unknown, not assumed absent.

Lovable can read the NeuroSpark project's metadata and confirms an enabled
Supabase backend. Its database-query action rejects even a metadata-only SELECT
because the installed connection lacks the required `projects:write` scope.
The connector's returned remediation is to remove and re-add the Lovable app
to refresh its permissions; reconnecting alone preserves the old scope set.
No database query or write was executed through that denied action. The
existing unpublished NeuroSpark copy has no enabled backend and is not a
ready isolated test environment.

An existing dedicated test project can unblock the prepared commands when its
`E2E_SUPABASE_URL`, `E2E_SUPABASE_PUBLISHABLE_KEY`, and
`E2E_SUPABASE_PROJECT_REF` are configured, along with the current schema,
anonymous sign-in, speech functions, rate-limit RPC, and server-side Azure
Speech settings. The production project remains denied by the test guards.

The local database setup leaves Functions disabled and has no Azure credentials.
The deployed-service preflight and bounded four-provider-check command remain
separate from the successful local database and controlled speech tests. No live
speech success is claimed here.
