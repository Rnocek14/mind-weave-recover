# Regression workflow verification — 2026-10-28

Base revision: `11f083804f924a2da2989a6acdd1e1584ea47bdb`.
These results describe local verification of this change. They are not a
production deployment or a passing authenticated-backend run.

## Results

| Check | Outcome | Evidence boundary |
|---|---|---|
| Baseline full Vitest suite | 1,892 passed; 25 skipped; 0 failed, across 143 files | Existing main before the test replacement. |
| Updated full Vitest suite | 1,899 passed; 25 skipped; 0 failed, across 143 files | New logger checks added seven net tests; existing skips unchanged. |
| Actual logger suite | 13 passed | Real hook, buffering, filtering, retry and replay; mocked database transport. |
| Environment guard tests | 23 passed | Configuration validation, actual generated-client transform and request guard. |
| Result-reporting tests | 8 passed | Skips, missing runs/core, expected failures and flaky retries cannot verify staging. |
| Chromium public browser suite | 19 passed; 0 skipped | Fresh local E2E build, inert backend. |
| Mobile WebKit public browser suite | 19 passed; 0 skipped | iPhone emulation; no actual phone or microphone. |
| E2E Vite build | Passed | Production backend reference scan enforced. |
| App and existing build-config type checks | Passed | Existing TypeScript projects. |
| Strict E2E type check | Passed | New configuration, fixtures, specs and reporter. |
| Full lint | 0 errors; 1,236 warnings | Baseline had 1,237 warnings; existing warning cleanup was outside scope. |
| Missing staging configuration | Rejected | Failure before browser/build/authentication. |
| Known production staging target | Rejected | Failure before browser/build/authentication. |
| Authenticated therapy suite | **NOT RUN — 14 cases discovered** | No accessible isolated NeuroSpark backend was available. Discovery is not execution. |

The verification components were executed separately; this record does not
claim a completed `qa:release` run. The release command intentionally requires
the missing isolated environment before it proceeds.

## Does the replacement test catch a real implementation regression?

A disposable local worktree was used to change the real logger's assignment
from `trial_mode: input.trialMode ?? null` to `trial_mode: null`.

| Test version | Result with the deliberate defect |
|---|---|
| Previous payload-only suite | All 6 checks passed; the dropped field was not detected. |
| Replacement actual-hook suite | 8 checks failed and 5 passed; the dropped field was detected. |
| Replacement suite after restoring the actual logger | All 13 checks passed. |

No mutation was made to the delivered production implementation. The new tests
inspect actual insert payloads; they do not reconstruct the mapping locally.

## Required before a release claim

Connect an isolated Supabase test backend containing the current schema and
synthetic seed data, enable anonymous sign-in there, and configure the dedicated
`E2E_SUPABASE_*` settings described in [the workflow](regression-workflow.md).
Run the full authenticated suite on the revision being released and inspect its
executed, failed, skipped, and flaky counts. The connected Supabase account
available during this work did not expose the NeuroSpark project, and its branch
lookup returned a permission error. No live authentication or database writes
were attempted as a workaround.

The manual GitHub workflow is prepared, but no branch-protection rule,
environment secret, or deployment gate was changed. Adding a skill and workflow
file does not itself enforce release approval.

## Existing follow-up: input-mode selection

The logger suite establishes that a supplied trial mode survives serialization.
It does not establish which mode the game/page supplies. The current
`PhotoNamingGame.tsx` tracks recognition for chip taps, while
`PhotoNamingExercise.tsx` supplies `trialMode: 'production'` to unified
submission. That relationship needs a separate reproduction and agreed-behavior
review before changing clinical interpretation. The persistence browser test
does not freeze either interpretation as correct.

No clinical engine, scoring, progression, speech behavior, content bank,
production database setting, or patient record was changed in this work.
