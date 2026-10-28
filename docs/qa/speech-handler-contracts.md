# Speech HTTP handler contracts without hosted credentials

## Purpose

A blocked hosted connection must not stop independent verification. The existing
browser speech suite supplies processed endpoint responses. This complementary
suite imports the actual `analyze-speech/index.ts` and
`analyze-pronunciation/index.ts`, their request builder, and their response
parsers. It checks the request-to-response contract before the browser receives
those values. No production implementation, clinical threshold, or database
schema is changed.

## Run

After installing the existing locked repository dependencies:

```bash
node --test scripts/speech-edge-handlers.test.mjs
```

The ordinary CI workflow runs this command for pull requests and main pushes.
This does not configure branch protection and does not remove the existing
`qa:release` requirements. The standalone local `bun run qa` command is unchanged;
run the command above alongside it when verifying speech handlers locally.

## Real implementation and controlled boundaries

The repository's existing TypeScript compiler transpiles the six production
source modules in memory, then each test executes them in a fresh Node VM
context. Assertions do not duplicate the metric-calculation algorithms.
`serve` registration is captured instead of binding a port. Authentication
results and rate-limit transport are controlled; these tests do not verify
Supabase JWT validation or rate-limit database policy. Azure HTTP is replaced
by known response fixtures, and every unexpected URL or import fails the test,
even if the application catches the error. No `.env` file is loaded and no
host `fetch`, provider credentials, or production client enters the context.
The VM is an import/test-isolation mechanism, not a security sandbox for
untrusted code.

The WAV fixture is a valid synthetic PCM container, not a recording of speech.
Its purpose is to verify format validation, byte preservation, and request
construction. Timing and score fixtures independently specify expected values.
Four words over three seconds must produce 80 words/minute; gaps of 0.2, 0.3,
and 0.8 seconds must produce three pauses, 1.3 seconds of total pause, and
433 milliseconds average pause. A measured zero remains zero. Missing timing
or prosody remains unavailable. The target word must not replace observed
speech in a returned transcript.

The failure cases check rejected authentication, denied rate checks, missing
credentials, invalid base64, unsupported/truncated audio, provider outages,
connection errors, invalid JSON, invalid schemas, and recognized no-speech
statuses. These must not become successful zero-score measurements.

## Evidence boundary

Passing this command establishes handler-level behavior with controlled external
responses. It does not establish live Azure recognition accuracy, Deno/hosted
gateway compatibility, physical microphone behavior, database persistence/RLS,
or clinical validity. Those remain separate checks. The four previously
prepared deployed Azure checks remain unexecuted until an authorized isolated
speech environment is configured; this suite is not a bypass of that gate.

Baseline before this addition: PR #76 at
`90f14cf0efdb0b763437fa3fd779d44397456859` had successful CI and evidence/build
runs. Results for this new suite must be taken from its actual Node test output
and the CI run on the new revision, not inferred from this document.
