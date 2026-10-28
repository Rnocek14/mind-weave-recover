# NeuroSpark regression and release readiness

## Status and scope

This is an engineering release checklist, not a guarantee of zero bugs or a
clinical validation claim. A green result proves only the assertions executed
on the named revision. Test counts are not a measure of complete app coverage.
Do not merge or deploy the current draft solely because the deterministic
checks pass. Production behavior, clinical rules, and patient records are
unchanged by this testing-hardening change.

## Required checks for a feature change

Use `bun run test:watch` during development and `bun run qa` before handoff.
`qa` now includes both the actual speech-handler contracts and gate tests,
alongside environment checks, lint, unit/component tests, all type projects,
and the public and synthetic-microphone browser suites. The same Bun 1.4.2 and
locked dependencies are used across the workflows. No package versions changed.

CI runs lint/tests/types, browser checks, and the production-bundle evidence
workflow. Its final **Regression gate** runs even when a dependency fails or is
skipped. Only successful completion of every required job satisfies the gate.
Public and staging browser summaries both reject skipped, unrun, failed,
unknown-result, empty, or retried cases. Discovery/list mode remains explicitly
NOT RUN. Unit .only markers and empty selections are rejected; automatic unit
retries remain off. The 25 pre-existing unit skips have NOT been repaired or
approved as release evidence; their individual identities are retained in the
unit-evidence artifact for triage. Adding a skipped test is not adding coverage.

For each change, document the intended behavior, adjacent risks, exact tests,
what was mocked, and any remaining unverified behavior in the PR. Reproduce a
bug before its fix where practical. Never weaken a test to make a change pass.

## Release sequence and enforcement boundary

The GitHub Pages publishing path now requires, in the SAME workflow invocation:

1. The artifact build and verification.
2. The reusable CI workflow, including the Regression gate.
3. The reusable isolated therapy workflow: authenticated persistence journeys
   and the four bounded deployed speech checks.
4. A Release gate that requires all three dependencies to succeed.

Reusable local workflow references and default checkout use the caller's
revision; this does not accept an old successful run on a different commit.
Publishing is restricted to main and remains opt-in through the existing
manual-dispatch/PAGES_ENABLED condition. Missing test configuration blocks an
attempted publication. This is a deliberate safety block, not an instruction
to substitute production credentials.

This gate controls **GitHub Pages only**. Lovable publishing, manual Supabase
function deployment, and other hosting routes are not controlled by this file.
Their permissions/release procedures must use the same approved revision and
verification evidence. No deployment route was enabled or exercised here.
The hosted staging functions must also be deployed from the candidate revision;
the current speech smoke test does NOT attest their source hash. A matching app
checkout alone does not establish matching backend code.

## Owner-level setup still required

The observed main branch is unprotected. The available GitHub connection can
write repository files, but does not expose an administration write for rules.
`main-ruleset.json` is an importable proposed ruleset, not an active rule.
After the Regression gate exists, a repository administrator should import it
under Settings -> Rules -> Rulesets, review it, and activate it. It requires a
PR and an up-to-date Regression gate, blocks branch deletion and force pushes,
and contains no bypass actors. Zero approving reviews is intentional for a
solo-owner repository; add independent clinical/code review separately. Select
GitHub Actions as the trusted check source in the UI where supported. Verify a
failing test PR really cannot merge. Do not claim activation until read-back
confirms it. Lovable/agents must work on branches, not push straight to main.

The protected `neurospark-e2e` environment needs:

- Secrets `E2E_SUPABASE_URL` and `E2E_SUPABASE_PUBLISHABLE_KEY` for the SAME
  explicitly verified test project, never a service-role key.
- Variable `E2E_SUPABASE_PROJECT_REF` matching that project.
- Candidate schema/functions, synthetic users only, anonymous sign-in for the
  existing fixtures, and server-side Azure key/region configured securely.

A branch record named `hospital-integrity-verified-2026-10-13` was found for
`stdiuaxigqttgdwiwbtp` on 2026-10-28, but `get_project` returned Project not found.
The function-list response alone did not resolve the conflicting project
identity evidence. This branch is NOT approved for writes or release tests
until its identity, availability, data policy, and function revision are verified.
No new project, billable branch, Azure resource, or credential was created.
The production Supabase access reconnect is no longer the original blocker.

## Coverage map: what must be demonstrated before a hospital pilot

| Area | Existing evidence starting point | Remaining acceptance evidence |
|---|---|---|
| Patient entry and session flow | Public UI checks; authenticated onboarding journeys | Full guided session, resume/quit, slow-loading and offline recovery on candidate revision |
| Games | Unit/contract tests and manual `src/data/qaScenarios.ts`; Photo Naming browser journeys | Inventory actual enabled games/routes. For EACH: start, correct/incorrect/skip, cues/replay/pause, completion, one saved attempt and reload |
| Speech capture | Chromium fake-mic suite and speech hooks | Physical iPhone/Safari, Android/Chrome and desktop; permission denial, interruption, Bluetooth, backgrounding |
| Analysis metrics | Actual HTTP handler contracts, parser/unit/display checks, response-timing tests | Fresh known recordings through deployed Azure with candidate functions; compare values and explicit unavailable states |
| Speech to saved report | Logger/presentation tests; Photo Naming tap-to-database journey | One real isolated spoken attempt traced through audio, provider result, saved rows and clinician/caregiver display/export |
| Progression | Existing unit/leveling contracts | Real owned progression writes, restart persistence, supported input modes and no duplicate advancement; spec registries alone are not runtime proof |
| Permissions | Signed-out route checks; ownership checks in the existing isolated journey | Real database denial across two patient accounts, unassigned clinician/caregiver, recording access, logout and deletion |
| Smart Coach / AI | Controlled responses where current tests exist | Representative reviewed prompts, wrong/uncertain output, stalls, safe recovery and real model evaluation |
| Clinical reporting | Timing, zero/null, aggregation and CSV regressions | Reconcile a known synthetic multi-session dataset with every clinician summary; historical data limitations visible |
| Release / recovery | Automated gate definitions in this PR | Active branch rule, verified staging, actual hosting enforcement, tested rollback and post-release synthetic smoke |

This table lists acceptance work, not claimed completed tests. Existing test
files need a behavior-by-behavior coverage audit. Prior local persistence passes
and historical Azure successes cannot replace a fresh controlled release run.
For a pilot, freeze new features while completing the matrix and reviewing
severity-one blockers. Every subsequently fixed defect gets a regression case.

## Evidence to keep for each candidate

Record Git SHA, backend/function revision, environment, command, passed/failed/
skipped/not-run counts, fixture versions, provider/model versions where exposed,
known limitations, reviewer/device sign-off, and rollback target. Retain only
synthetic data in automated artifacts; never export patient recordings or keys.

Engineering checks do not establish efficacy for aphasia. Representative,
consented speech with qualified clinician-reviewed expectations is a separate
validation stream; synthetic speech is useful for repeatability, not clinical
representativeness. Treat low-confidence or unavailable measurements as such,
not as patient failure.
