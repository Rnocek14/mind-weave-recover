# NeuroSpark regression and release readiness

## Status and scope

This is an engineering release checklist, not a guarantee of zero bugs or a
clinical validation claim. A green result proves only assertions executed on the
named revision. Test counts do not establish complete application coverage.
This draft is not authorized for publication solely because CI passes.

The 2026-10-28 follow-up re-enabled all 25 quarantined classifier tests and
reproduced five failures. A narrowly scoped semantic relationship/answer-
validation distinction corrects the demonstrated defect without changing
numeric thresholds. See [classifier quarantine resolution](classifier-quarantine-resolution.md)
for the reproduction, test expectation rationale and verification boundaries.
Read the candidate's actual CI result for its final pass/fail counts.

## Required checks for a feature change

Use `bun run test:watch` during development and `bun run qa` before handoff.
The latter includes actual speech-handler contracts, workflow and unit-result
gate tests, environment checks, lint, unit/component tests, all type projects,
and public/synthetic-microphone browser suites. Use Bun 1.4.2 and locked packages.
No dependencies were upgraded in the gate or classifier follow-ups.

`bun run test` now requires a fresh complete JSON report: every selected test
must pass and match the totals. Skipped/pending/todo/failed/unknown assertions,
empty runs, missing reports and stale-success substitution fail. Retries, .only
and pass-with-no-tests are disabled. CI and the evidence/build job use this same
command. The historical skipped tests are no longer exempt from completion.

CI runs lint/tests/types, browsers and production-bundle evidence. The final
**Regression gate** evaluates even when dependencies fail or skip. Only success
of every required job passes. Browser summaries reject skipped, unrun, failed,
unknown, empty or retried cases. Discovery/list mode remains NOT RUN.

Each PR must identify changed behavior, adjacent risks, actual tests, mocks and
unverified behavior. Reproduce defects before fixing them where practical.
Never weaken or quarantine a failing requirement merely to obtain green CI.

## Release sequence and enforcement boundary

GitHub Pages publication requires in the same workflow invocation:

1. Artifact build and verification.
2. Reusable CI, including the Regression gate.
3. Isolated authenticated persistence and four bounded live-speech checks.
4. A Release gate requiring all three dependencies to succeed.

Local reusable workflows and default checkout use the candidate revision,
not an old green run on a different commit. Publishing is restricted to main
and remains opt-in through manual dispatch/PAGES_ENABLED. Missing test inputs
block publication; do not substitute production credentials.

This only gates **GitHub Pages**. Lovable publishing, manual Supabase function
deployments and other hosting paths need equivalent permissions/processes.
No deployment path has been enabled or exercised by this change. Staging
functions must match the candidate; current speech smoke checks do not attest
the backend's source hash. Matching frontend checkout alone is insufficient.

## Owner-level enforcement still required

Observed main is unprotected. The connected GitHub app can write repository
files but cannot administer rules. `main-ruleset.json` is an importable proposal,
not an active rule. An administrator should review/import/activate it under
Settings -> Rules -> Rulesets. It requires PRs and an up-to-date Regression gate,
blocks deletion/force pushes, and contains no bypass actors. Zero approving
reviews accommodates a solo-owner repo; independent clinical/code review is
separate. Select GitHub Actions as trusted check source where supported.
Read back the rule and verify an intentionally failing PR cannot merge.
Lovable and other agents must work on branches rather than writing main.

## Isolated environment still needs configuration and verification

Protected GitHub environment `neurospark-e2e` needs secrets
`E2E_SUPABASE_URL`, `E2E_SUPABASE_PUBLISHABLE_KEY`, and variable
`E2E_SUPABASE_PROJECT_REF`, all pointing to the same verified test project.
Never use a service-role key. The backend needs candidate schema/functions,
synthetic-only data, anonymous sign-in for the fixtures, and secure server-side
Azure key/region configuration.

The existing branch `hospital-integrity-verified-2026-10-13` maps to
`stdiuaxigqttgdwiwbtp` with `with_data: false`. The earlier top-level project
lookup returned Project not found. Direct read-only SQL on the explicit branch
now succeeds and shows 171 migration records, zero auth users, zero sessions
and zero exercise events. Reachability is therefore no longer the database
blocker. Candidate functions, auth/provider configuration, protected CI inputs
and a fresh complete run remain unverified. Do not interpret counts as complete
schema equivalence, RLS validation or backend-version attestation.
No project, billable branch, account, credential or provider request was created.

## Coverage required before a hospital pilot

| Area | Existing evidence starting point | Remaining acceptance evidence |
|---|---|---|
| Patient entry/session | Public and historical authenticated journeys | Full guided session, resume/quit, slow loading and offline recovery on candidate |
| Games | Unit/contracts/manual qaScenarios; Photo Naming browser journeys | Every enabled game: start, correct/incorrect/skip, cues/replay/pause, completion, one save and reload |
| Speech capture | Chromium fake mic and speech hooks | Physical iPhone/Safari, Android/Chrome and desktop; denial, interruption, Bluetooth, backgrounding |
| Analysis/classification | Actual handler contracts, arithmetic/display tests and restored classifier coverage | Known recordings through deployed candidate/Azure; explicit unavailable states; clinician-reviewed representative speech |
| Speech-to-report | Logger/presentation tests; historical isolated Photo Naming persistence | One spoken attempt traced from audio/provider through saved rows to clinician/caregiver display/export |
| Progression | Unit/leveling contracts | Owned writes, restart persistence, correct mode routing and no duplicate advancement |
| Permissions | Signed-out checks; ownership assertions | Real denial across two patient accounts, unassigned clinician/caregiver, audio access, logout/deletion |
| Coach/AI | Controlled-response tests where present | Representative reviewed prompts, uncertain/wrong outputs, stalls and safe recovery |
| Reporting | Zero/null/timing/aggregation/CSV regressions | Known synthetic multi-session dataset reconciled to every summary; historical limitations visible |
| Release/recovery | Automated gate definitions | Active branch rule, all deployment routes restricted, tested rollback and synthetic post-release smoke |

These are acceptance requirements, not claimed completed tests. Audit behaviors,
not just filenames/counts. Historical local database and Azure results cannot
replace fresh candidate verification. Freeze new features during the pilot
baseline audit; each subsequently fixed defect gets a regression case.

Keep candidate Git SHA, backend revision, environment, exact commands and
passed/failed/skipped/not-run counts, fixture/provider versions, limitations,
reviewer/device sign-off and rollback target. Artifacts must contain synthetic
data only, never patient recordings or keys. Engineering tests do not establish
clinical efficacy; low-confidence/unavailable data must not become patient failure.
