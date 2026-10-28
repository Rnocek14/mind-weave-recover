# Speech recording and analysis regression verification

This change extends the regression workflow with real Chromium microphone
capture, controlled speech journeys, and tests of the production analysis,
serialization, and aggregation code. It also corrects defects reproduced by
those tests. It does not establish clinical validity or live provider accuracy.

## Initial speech results — 2026-10-28

These results describe the speech changes at
`f12bc916969bcbca9bf04d429f99f4e5fac7a72f`. The subsequent response-time correction
and its verification are documented in
[response-time-verification.md](./response-time-verification.md).

The later [isolated database verification](./isolated-database-verification.md)
replayed all 171 migrations and completed the 14-case authenticated suite
without failures, skips, unrun cases, retries, or flakes. Its real database
assertions cover the tested chip-answer ownership and accepted-answer timing
before and after reload. The initial results below remain the historical speech
baseline; deployed Azure speech checks are still not run.

| Check | Result |
|---|---|
| Full unit/hook/contract suite | 2,033 passed across 157 files; 25 existing skips; zero failures. |
| Environment, result-reporting, live-service guard, and worker checks | 44 passed; zero failures or skips. |
| Public Chromium and mobile WebKit journeys | 38 passed; zero skips, retries, or flaky results. |
| Real microphone capture and controlled speech journeys | 11 passed; zero skips, retries, or flaky results. |
| App, build configuration, E2E, and harness type checks | Passed. |
| Three changed Edge Function entrypoints (`deno check`) | Passed. |
| Existing lint gate | Zero errors; 1,217 warnings remain. |
| Live speech-service preflight | Correctly blocked before authentication or requests; four provider checks planned, zero executed. |
| Authenticated therapy persistence | Not run; 14 cases were discovered only. |

The final full unit run includes 134 additional tests relative to the earlier
regression-workflow branch. Each new browser case runs with retries disabled.
These are local results; the pull request's automated checks must also succeed
on the revision being shipped. The isolated backend checks remain required
before claiming deployed speech and persistence verification.

## What the tests found and what changed

| Reproduced problem | Correction and regression protection |
|---|---|
| Photo Naming could show answer feedback while skipping audio upload and analysis. Its memoized transcript callback retained an answer handler from before the recorder started. | Dispatch through the current handler and pass the observed transcript explicitly. The actual-game browser tests require captured audio, both analysis requests, and the submitted attempt payload. |
| Browser WebM/mp4 was sent directly to an endpoint that supports PCM WAV or Ogg Opus. | Recorded transcription and Conversation Coach use the shared WAV conversion and validated client paths. Server request builders verify the actual format bytes and canonical headers. |
| Missing pronunciation assessment, optional prosody, or timing became manufactured zero measurements; a target word could substitute for an absent transcript. | Required score/schema failures remain unsuccessful; unavailable optional measurements remain null/undefined. Actual zero remains zero. Only observed transcripts populate the live panel. |
| Azure tick strings were added before numeric conversion; an exact 100 ms gap could cross the existing threshold through floating-point rounding. | Convert timestamps before arithmetic and compare integer ticks. The existing pause threshold remains unchanged. |
| Display-normalized text could change spoken word counts; absent timings appeared to prove zero pauses. | Count lexical words, preserve unavailable timing, and distinguish recognized-speech duration from full recording duration. A zero pause denominator does not produce a finite speech-to-pause ratio. |
| Classifier confidence appeared as ASR confidence, and seconds were not consistently converted to milliseconds. | Pass the actual recognizer confidence separately and explicitly convert duration and pause units. Preserve distinct phonological and pseudo-phoneme measures. |
| A new attempt could retain old scores, and delayed results could overwrite current analysis. | Clear utterance-specific measurements at attempt start and require the captured attempt identity for delayed live updates. Saving retains the original attempt identity. |
| A microphone-lock retry from the previous question could score the next question or leave it processing. | Check the originating trial before deferred callbacks change state and before dispatching the current answer handler. A controlled-clock actual-game test reproduced the failure and passes after the correction. |
| The exercise page could erase valid pronunciation scores while completing its same-attempt save, and replace the trial number with a stale pivot counter. | The page updates only the speech fields it owns and uses the completed result's trial identity. Tests exercise the actual page mapper through the live context, including a measured zero score. |
| An older deployed speech endpoint can return HTTP 200 with an error marked `fallback: true`. | Reject that legacy error envelope instead of treating it as observed silence with measured zero confidence. |
| Measured zeros disappeared from saved analytics and audio examples. Missing observations entered averages as zero or through a guessed duration. | Use finite measurements, independent per-metric denominators, and a measured positive duration for pauses/minute. Unmeasured averages display as unavailable. |
| A 12-second recording was silently reduced to 10 seconds while reporting the original duration. In the reproduction, the spoken answer after 10.5 seconds disappeared entirely. | Preserve the existing 10-second analysis resource limit and reject longer recordings before conversion. Do not send partial recordings for analysis. Extending long-recording support remains separate work. |
| Staff reprocessing relabeled stored audio as WAV and duplicated the old score parser. | Reuse the validated request/parser functions. Unsupported stored formats fail explicitly before Azure; no server transcoder was added. |

No clinical scoring thresholds, progression rules, exercise-selection rules,
or queue retry policies were changed. The changes correct input handling,
measurement provenance, arithmetic, and reporting around the existing rules.

## Executed layers and their evidence boundaries

### Unit, hook, and contract checks

`bun run test:speech` runs the production request builders/parsers, frontend
analysis clients, actual logging and analytics hooks, utterance mapping, and
metric display tests. Database and provider transport are controlled. These
tests verify submitted values and application handling, not live persistence.

The numeric fixtures contain independent expectations. For example, four spoken
words over a three-second recognized interval yield 80 words/minute. Word gaps
of 0.2, 0.3, and 0.8 seconds yield three pauses, 1.3 seconds of total pause,
433 ms average pause, and a 1.31 speech-to-pause ratio under the existing
inter-word-gap definition. No score threshold for clinical success is inferred
from these fixtures.

Failure-before/fix-after checks reproduced the stale display, invalid scores,
missing-value defaults, confidence/unit mapping, backend arithmetic/parsing,
Conversation Coach, stored analytics, and staff retry defects. The focused
tests were observed passing after the corresponding corrections.

### Real browser capture and controlled game integration

`bun run test:e2e:speech` launches a fresh local test bundle on port 4175.
Chromium receives synthetic WAV microphone input. The suite exercises actual
`getUserMedia`, `MediaRecorder`, Web Audio decoding/resampling, the production
converter, `PhotoNamingGame`, analysis clients, and utterance logger.

The eleven selected cases cover clear and hesitant audio, silence, recording
restart/release, over-limit rejection, known-answer metrics, delayed-result
identity, a deferred microphone-lock callback after advancing, and
upload/invalid-analysis failures. The tentative/final transcript
cases verify application handling and duplicate protection. They do not measure
native Web Speech transcription accuracy or the hard-mode timeout.

The browser recognition API emits controlled events, and explicit local HTTP
routes supply provider/database responses. Synthetic auth is cached locally;
the suite does not call a real auth service. Unexpected external requests and
unconfigured backend operations fail the test. The same generated-client
isolation transform and production-reference bundle guard are reused.

The harness mounts the actual game. Separate tests exercise the actual
exercise-page mapper through the live context, along with metric-card display.
Complete route entry and real database saving remain in the separate isolated
therapy suite.

The fixture manifest records hashes, format, generated words, and limitations.
The recordings were synthesized locally with FFmpeg/libflite and contain no
patient voice. Their controlled metric responses are not acoustic ground truth
or a representative aphasia speech dataset.

Reports:

- `test-results/speech-summary.json`: executed/pass/fail/skip/unrun/retry counts
  and explicit evidence boundaries.
- `test-results/speech-results.json`: Playwright JSON detail.
- `playwright-report/speech/`: browser report and retained failure diagnostics.

Selected skips, unrun cases, expected failures, or retries cannot make the
speech verification pass. Discovery is reported as not run.

### Deployed speech-service verification

The real-service command is prepared but was **not executed against a service**
in this environment. At the initial speech-verification run, the connected
Supabase account did not permit access to the NeuroSpark project, and no
isolated NeuroSpark backend was configured. The missing-configuration preflight
was executed and correctly blocked before authentication or requests: four
planned provider checks, zero executed. The subsequent native local database
setup verifies authenticated persistence, but leaves Functions disabled and
has no Azure credentials; it does not change this provider-verification result.

Use a verified disposable local instance or dedicated test project with:

- The current application schema, anonymous sign-in, and rate-limit RPC.
- The updated `analyze-speech` and `analyze-pronunciation` functions.
- Server-side Azure Speech credentials. Keep them out of client configuration,
  source control, reports, and chat.
- The existing explicit `E2E_SUPABASE_URL`, `E2E_SUPABASE_PUBLISHABLE_KEY`, and
  `E2E_SUPABASE_PROJECT_REF` configuration accepted by the environment guard.

Run:

```bash
bun run test:speech:services:check-env
bun run test:speech:services
```

The explicit live run creates one synthetic anonymous session and makes at
most four sequential provider checks: two short synthetic recordings through
both endpoints, with no retries. It checks normalized words, response shape,
numeric ranges, timing consistency, and correlation IDs when returned. It does
not impose a pronunciation-score minimum. Sign-out does not delete the
synthetic user; clean up only within the disposable test environment.

This command does not verify database durability/RLS, native browser ASR,
physical microphone behavior, or provider accuracy across patient speech.
`bun run test:e2e:staging` separately verifies authenticated therapy persistence.

## Commands and automation

| Command | Scope |
|---|---|
| `bun run test:speech` | Focused speech contracts, hooks, mapping, aggregation, and display. |
| `bun run test:e2e:speech` | Real Chromium fake-microphone capture and controlled actual-game integration. |
| `bun run test:test-env` | Environment/result guards, live-harness guard tests, and actual converter-worker checks. |
| `bun run typecheck` | App, Vite/Node, Playwright, and speech-harness typing. |
| `bun run qa` | Existing full gate plus the local speech browser suite. |
| `bun run qa:release` | Existing isolated therapy requirements plus bounded deployed speech-service checks. |

The ordinary CI job runs the local speech suite without live credentials. The
manual isolated-therapy workflow includes the real speech-service command.
Workflow definitions do not themselves make a check a required merge or release
gate; repository/release enforcement must require the intended successful
checks on the revision being shipped.

All three changed Edge Function entrypoints were also checked with Deno:

```bash
deno check --no-config --no-lock \
  supabase/functions/analyze-speech/index.ts \
  supabase/functions/analyze-pronunciation/index.ts \
  supabase/functions/pipeline-ops/index.ts
```

## Compatibility and remaining limitations

- The database's historical `transcript_source` CHECK accepts `whisper`,
  `browser`, and `manual`. Logical Azure results retain the legacy `whisper`
  wire value and record the actual provider in `audio_meta.transcriptProvider`.
  `gop_data.source` separately identifies pronunciation provenance. This change
  adds no schema migration and does not assume a new column is deployed.
- Historical measurements already stored as fabricated zeros or with incorrect
  units/provenance are not repaired by these code changes. They require a
  separate data review; averages here are verified against the supplied rows.
- Recordings beyond the existing 10-second conversion limit are now explicitly
  unavailable for analysis. Supporting full longer recordings requires a
  separate bounded conversion/provider design.
- Staff retry jobs cannot currently transcode historical WebM/mp4 recordings.
  Those inputs now fail visibly instead of being sent with a false WAV label.
- The historical `latency_ms` field records analysis-completion time. The
  [response-time follow-up](./response-time-verification.md) separates accepted
  answer timing and corrects its consumers. Untagged historical utterance rows
  remain unavailable for response-time reporting; their timing is not guessed
  or backfilled.
- Physical iPhone/Safari/Android microphones, permission interruptions,
  Bluetooth routing, and speaker-to-microphone echo require real-device checks.

## Primary protocol references

- [Chromium fake-audio input flags](https://chromium.googlesource.com/chromium/src/+/main/media/base/media_switches.cc)
- [Azure short-audio REST request/response contract](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)
- [Azure pronunciation assessment](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment)
- [Playwright browser launch options](https://playwright.dev/docs/api/class-browsertype)
