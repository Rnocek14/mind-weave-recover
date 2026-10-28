# Local speech browser regressions

Run from the repository root:

```bash
bun run test:e2e:speech
```

The suite builds a separate test entry and launches installed Chromium with a
synthetic WAV file as its microphone. It does not load the normal app entry or
contact a speech service. The tested `PhotoNamingGame`, `useSpeechRecognition`,
`useAudioRecorder`, WAV converter, analysis client, and utterance logger are the
actual production implementations.

## What runs

| Check | Real behavior exercised | Controlled boundary |
|---|---|---|
| Clear answer, hesitant answer, silence | Native `getUserMedia`, `MediaRecorder`, worker/fallback conversion, complete 16 kHz mono PCM output, silent gap preservation | Chromium reads a committed WAV instead of a physical microphone |
| Cancel and restart | Recorder stop/release and a fresh recording | Synthetic audio source |
| Known Photo Naming answer | Real game/hook state, recorded audio, WAV request encoding, classification, callback, utterance payload, exact zero/missing metric handling | Explicit Web Speech API events and HTTP service responses |
| Interim hesitation | No early submission during a specified observation window; one completed final answer | Recognition interim/final events are supplied by the test |
| No speech and restart | Existing recognition restart state machine, unchanged trial, no duplicate recorder or analysis submission | A controlled `no-speech` event |
| Delayed results | Original attempt/trial identity on submitted payload, no stale score on the next trial | Analysis responses are held and released out of order |
| Delayed microphone-lock retry | An old transcript cannot score or put the next trial into processing after a chip advances it | Real voice-controller lock/tail and game timers are driven with a controlled clock |
| Service/storage failure | Invalid measurements stay unavailable; no claimed audio path after failed upload | Explicit failing HTTP responses |
| Recording longer than the existing analysis limit | Conversion rejects the complete over-limit recording instead of silently dropping its ending | Synthetic answer begins after ten seconds |

The eleven-case game/recorder suite supplies fixed synthetic trials, a cached synthetic identity,
and context providers. It observes the real component's completion callback and
Live Analysis state. It does **not** verify route entry, real sign-in, database
durability, access policies, or the full exercise-page caller. Those remain in
the isolated authenticated suite and dedicated integration tests.

The recorder-only cases do not run a speech recognizer. Game cases replace only
the browser `SpeechRecognition` API event source: a passing recorded-audio test
does not prove Chrome's native recognition service understood the WAV. All
HTTP/WebSocket origins except the local test app are intercepted, and only
explicit inert backend contracts receive synthetic responses. Unexpected
requests fail the test. The existing production-backend bundle scan and request
guard are reused. No production account or data is accessed.

## Fixtures and metric expectations

`fixtures/manifest.json` records each file's SHA-256, generated words, timing,
format, and limitations. `generate-fixtures.mjs` uses local FFmpeg/libflite's
`slt` voice. The files contain no patient recordings and require no cloud TTS.
Regenerate them only intentionally, using a local FFmpeg build with `flite`:

```bash
node tests/e2e/speech/generate-fixtures.mjs
```

CI consumes the committed files; FFmpeg is not a test runtime dependency.
Chromium's `%noloop` suffix prevents replay from inventing repeated utterances.
The clear fixture says “apple.” The hesitant fixture says “uh,” has an inserted
silent gap, then says “apple.” This is synthetic timing input, not a clinical
sample. The over-limit fixture puts its answer after 10.5 seconds to expose
silent truncation.

The fixed analysis scores are **transport fixtures**, not ground-truth
pronunciation ratings for these recordings. Browser assertions verify that
these supplied values and units reach the correct attempt unchanged, that
measured zero remains zero, and that unavailable fields stay unavailable.
Backend parser/measurement tests verify calculations separately. An explicitly
configured isolated speech-service run is required to establish that deployed
functions and Azure return usable measurements; representative speech and
agreed criteria are required to evaluate recognition/pronunciation quality.

## Results and limits

`test-results/speech-summary.json` reports selected, passed, failed, skipped,
not-run, retries, and evidence boundaries. Any selected failure, skip, missing
execution, or retry makes the command fail. Discovery with `--list` is labeled
not run and does not overwrite execution evidence. The full Playwright JSON is
`test-results/speech-results.json`; traces/screenshots/videos for failures are
under `test-results/speech`, with an HTML report under `playwright-report/speech`.

The harness is checked with
`tsc --noEmit -p tests/e2e/speech/tsconfig.harness.json`, using the application's
existing compiler options. Playwright/support files use `tsconfig.e2e.json`.
`node tests/e2e/speech/converter-worker.test.mjs` separately invokes the actual
worker script with a controlled decoder to check rejection before resampling
and preservation of the existing ten-second boundary. Chromium currently uses
the production main-thread fallback when its worker lacks `OfflineAudioContext`.

Physical iPhone/Safari and Android audio routing, microphone permissions,
Bluetooth, interruptions, backgrounding, echo, real recognition service
availability, model accuracy, and clinical effectiveness are not established
by this local suite.
