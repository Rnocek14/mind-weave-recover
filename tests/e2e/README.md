# Browser regression tests

Two explicit suites share the existing Playwright setup. Public tests run
without a backend. Authenticated therapy tests create synthetic users and
records only in an explicitly selected, isolated Supabase test project.

## Local commands

Install the project's locked dependencies and Playwright browsers first:

```bash
bun install --frozen-lockfile
bunx playwright install --with-deps chromium webkit
bun run test:test-env
bun run test:e2e
```

`test:e2e` runs public routes, auth redirects, provider rendering, and offline
page checks on Chromium desktop and emulated mobile WebKit. It does not
authenticate or verify therapy persistence. Its summary states
`authenticatedTherapy: NOT RUN: public smoke suite only`.

For authenticated checks, configure a disposable test project with the
application schema and anonymous sign-in enabled. Never enable or change
production authentication to make these tests run. Supply these values as
dedicated `E2E_*` environment variables. Bun may load environment files before
the runner starts, but the guard never falls back from these dedicated variables
to `VITE_*` settings or the tracked production configuration:

```bash
export E2E_SUPABASE_URL='https://YOUR_TEST_PROJECT_REF.supabase.co'
export E2E_SUPABASE_PROJECT_REF='YOUR_TEST_PROJECT_REF'
export E2E_SUPABASE_PUBLISHABLE_KEY='YOUR_TEST_PUBLISHABLE_KEY'
bun run test:e2e:staging
```

For a local Supabase stack, use `http://127.0.0.1:54321`, project ref `local`,
and its local publishable/anon key. The project must already contain the
application schema and required seed content. Provisioning that environment
is separate from a passing test run; missing tables, unavailable auth, and
failed writes are failures, not skips.

`bun run qa:release` is the complete pre-release command. A public-only run
is insufficient to claim authenticated therapy has been verified.

## What the staging suite checks

- `core-loop.spec.ts`: answer three Photo Naming trials through the UI;
  require exactly three saved rows, distinct attempt IDs, trial indices 1–3,
  one session belonging to the test user, and persistence across a reload.
  Ownership is read through `sessions.user_id`; `exercise_events` has no
  `user_id` column.
- `pass-b-patient-journey.spec.ts`: authenticated patient route rendering.
- `exercise-session.spec.ts`: the actual pause/resume control.

The core loop does not claim to validate microphone hardware, AI analysis
quality, clinical efficacy, every scoring rule, or clinician access policies.
Those require their own focused checks. Staging tests get fresh anonymous
users; use a disposable environment and its normal reset/cleanup process to
remove synthetic users and their rows. Tests use no service-role key.

## Isolation and honest results

- `scripts/e2e-environment.mjs` validates the explicit project, key, and
  local app origin before any build or sign-in. Production, secret keys,
  missing configuration, and mismatched project references are rejected.
- The app's generated Supabase client currently contains literal production
  settings. `vite.config.ts` in this directory replaces exactly those two
  literals during the E2E build, preserving the actual client/auth/storage
  code. Source drift fails the build. The production source is unchanged.
- All other `VITE_SUPABASE_*` consumers receive the same test settings.
  An output scan rejects any bundle containing the production project ref.
- Every browser spec imports `fixtures/safeTest` (directly or through
  `anonSession`). Its automatic HTTP/WebSocket guard blocks production and
  other Supabase projects; the public suite's dummy backend is intercepted.
- Playwright builds `dist-e2e` and starts its own loopback server. Existing
  servers and remote `PLAYWRIGHT_BASE_URL` overrides are refused so a stale
  or live bundle cannot be tested accidentally. Production prerendering is
  not part of this build.
- Auth failures never skip selected staging journeys. The staging reporter
  fails incomplete runs, including omitted core-loop coverage, skipped or
  expected-failing tests, flaky retries, and selected tests that did not run.
  A `--list` discovery run is
  explicitly reported as not run.

Read `test-results/e2e-summary.json` for selected, passed, failed, skipped,
and not-run counts, plus retries/flakiness. The HTML report is in `playwright-report`; failures keep
traces, screenshots, and videos. Review the expected behavior before changing
a failing assertion. Do not add retries or weaken checks to obtain a pass.

## GitHub runs

Normal CI runs the public suite. `Isolated therapy verification` is a separate
manually dispatched workflow until an isolated environment is available and
its access is configured. In GitHub environment `neurospark-e2e`, supply
secrets `E2E_SUPABASE_URL` and `E2E_SUPABASE_PUBLISHABLE_KEY`, plus variable
`E2E_SUPABASE_PROJECT_REF`. Its preflight fails before installs if these are
missing. A release needs a completed passing staging run on the code being
released; this workflow file alone does not enforce branch protection or
deployment gating.
