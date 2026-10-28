# Regression testing for NeuroSpark

Regression tests check that an intended behavior continues to work after a
change. Extend the existing tests around behaviors that matter to patients and
clinicians. A passing test is evidence only for the behavior and boundaries it
actually exercises.

## Existing tools and commands

Install the locked dependencies with `bun install --frozen-lockfile`.
The isolated-therapy workflow pins Bun 1.4.2. Reuse the versions in `bun.lock`;
do not upgrade the toolchain as part of an unrelated behavior change.

| Command | Purpose |
|---|---|
| `bun run test:watch` | Rerun unit/component tests while editing. |
| `bun run test -- <test-file>` | Run the targeted Vitest regression. |
| `bun run test` | Run the complete Vitest suite once. |
| `bun run test:test-env` | Verify test environment and client override guards without a backend. |
| `bun run typecheck:e2e` | Type-check the Playwright configuration, fixtures, and browser tests. |
| `bun run test:e2e` | Public UI and signed-out route boundaries, using an inert backend. |
| `bun run test:speech` | Speech metric contracts, real hooks, mapping, aggregation, and display. |
| `bun run test:e2e:speech` | Chromium synthetic-microphone capture and controlled game/analysis integration. |
| `bun run test:speech:services:check-env` | Validate the isolated live speech prerequisites without authentication or requests. |
| `bun run test:speech:services` | At most four deployed speech-service checks using two synthetic recordings. |
| `bun run test:e2e:ui` | Inspect the public browser suite interactively. |
| `bun run test:e2e:check-env` | Reject missing/unsafe isolated-backend configuration before a release run. |
| `bun run test:e2e:staging` | Mandatory authenticated journeys against an isolated backend. |
| `bun run qa` | Environment guards, lint, unit tests, type checks, public and local speech browser suites. |
| `bun run qa:release` | Preflight, ordinary QA, authenticated therapy, and deployed speech-service checks. |

Install the configured browsers with
`bunx playwright install --with-deps chromium webkit`. Browser failures retain
screenshots, traces, and video in the report. Use `bunx playwright show-report`
to inspect the HTML report or `bunx playwright show-trace <trace.zip>` for a trace.

## The routine for each meaningful change

1. Identify the intended behavior and nearby failure risks. Start with the
   recent bug or the production function/hook the change touches.
2. Run the relevant baseline. Record existing failures and skipped tests.
3. Add a behavioral check that calls the actual implementation. Keep simple
   logic in unit tests; test application connections where saving, identity,
   scoring metadata, or permissions cross a boundary; reserve browser tests
   for critical journeys.
4. Make the change. For a bug, reproduce failure before the fix and success
   after it when feasible. Do intentional breakage only in a disposable copy.
5. Run the focused checks, then the applicable broader suites. Inspect their
   output; a successful exit alone does not mean every expected check ran.
6. Report actual results and limits. Before release, the authenticated therapy
   suite must execute successfully on the revision being released.

Do not delete or relax a failing expectation to hide a defect. When an intended
requirement changes, explain why the expectation changes with it. Do not add
large suites for simple prose or cosmetic edits.

## Browser suites, with explicit evidence limits

The added speech suite and measurement corrections are documented in
[speech analysis verification](speech-analysis-verification.md). It exercises
real browser audio capture with controlled recognition and backend responses;
it does not replace isolated therapy or deployed speech-service verification.

### Public suite

`bun run test:e2e` starts a fresh local app built into `dist-e2e`. It exercises
public pages, signed-out route boundaries, and local UI regressions. Its backend
is an inert localhost origin, and backend requests are blocked by the fixture.
It creates no real authentication users and provides no evidence of live data
saving, account permissions, or authenticated therapy behavior.

The generated Supabase client contains production constants. The E2E-only Vite
configuration replaces exactly those constants while preserving the client's
actual auth and storage code. The transform fails if the expected declarations
change. The production client and normal Vite build remain untouched.

`PLAYWRIGHT_NO_SERVER` and remote or reused app origins are rejected. Every run
builds and starts its own app, so a stale browser bundle cannot silently use a
different backend from the verification client.

### Isolated authenticated suite

Use a disposable local Supabase instance or a dedicated test project containing
this repository's schema. It must have anonymous sign-in enabled and synthetic
data only. Creating an anonymous auth user is itself a write, so validation runs
before sign-in, including in tests that subsequently only navigate.

Set these environment variables in your shell or protected CI environment:

| Variable | Required value |
|---|---|
| `E2E_SUPABASE_URL` | Exact isolated project origin, or `http://127.0.0.1:54321` for a local instance. |
| `E2E_SUPABASE_PUBLISHABLE_KEY` | Publishable or legacy anon key for that isolated backend; never a privileged key. |
| `E2E_SUPABASE_PROJECT_REF` | The isolated hosted project ref, or `local` for the supported local origin. |

Do not put these values in tracked `.env`, source files, or reports. The scripts
read explicit environment values; the repository's production `.env` is not
an acceptable fallback. The environment guard rejects the known production
project, inconsistent origin/ref pairs, unsupported origins, and privileged or
mismatched legacy keys. Naming an unknown hosted project does not independently
prove that it is disposable: verify the selected project's purpose first.

Then run:

```bash
bun run test:e2e:check-env
bun run test:e2e:staging
```

Missing settings, unavailable auth, or skipped required tests fail this suite.
Each test has a new anonymous user, so another test's records cannot make it
pass. Signing out ends the session; it does not delete the anonymous user or
their synthetic records. Reset or clean the isolated environment through your
test-data lifecycle; never run cleanup against production.

The Photo Naming core test completes three chip-answer trials and checks
per-trial persistence, unique attempt identities, common session identity,
patient ownership through the sessions relationship, and readability after a
reload. It does not claim to validate microphone capture, every scoring rule,
every exercise, or clinical effectiveness.

## Automation already in the repository

The ordinary CI workflow runs environment guard tests, lint, the full unit
suite, type checking, and public Playwright checks for pull requests and pushes
to main. Its summary explicitly states that authenticated persistence did not
run in the public job.

The `Isolated therapy verification` workflow is manually dispatched on the
revision to verify. Configure the `neurospark-e2e` GitHub environment with secrets
`E2E_SUPABASE_URL` and `E2E_SUPABASE_PUBLISHABLE_KEY`, plus variable
`E2E_SUPABASE_PROJECT_REF`. It runs the mandatory suite and uploads failure
evidence. This workflow and the personal skill do not themselves configure
branch protection or block a deployment. Release enforcement must require this
check on the exact release revision; until configured, its absence is a release
verification gap, not a pass.

## What the strengthened logger tests prove

`src/hooks/__tests__/photoNamingTrialMode.test.ts` mounts the real
`useAdaptationTrialLogger`, calls it, and inspects its database writes. It covers
spoken/tapped/scaffolded metadata, ownership, null versus zero/false values,
buffering, interval flushing, filtered attempts, missing identity, retry, and
page-exit replay. Only the database transport is mocked.

These tests do not establish that PhotoNamingGame selected the correct input
mode or that the real database accepts the payload. Those boundaries need
separate browser/integration checks. Keep those claims separate in review notes.

## When a test fails

Read the first failed expectation and its inputs. Determine whether it reflects
a changed requirement, a product regression, a broken test fixture, or a missing
environment prerequisite. Reproduce the smallest relevant case. Use Playwright
traces for UI timing and locators; wait for meaningful state instead of adding
fixed sleeps. Retries can diagnose intermittency but must not conceal a flaky
critical journey.

Report passed, failed, skipped, and not-run counts, the command and revision,
whether services were mocked, and the reason for every material gap. Keep real
microphone/device checks and AI-quality evaluations distinct from deterministic
application tests.
