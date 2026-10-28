# NeuroSpark development and regression testing

Use the existing React/Vite/TypeScript, Vitest, Playwright, and Bun setup.
Read `QA_CHECKLIST.md`, `docs/qa/regression-workflow.md`, and the current
`docs/qa/release-readiness.md` for commands, coverage gaps, and release boundaries.
Inspect the actual code and test configuration before relying on older plans or counts.

## For meaningful behavior changes

1. Identify the behavior being changed and the adjacent behaviors at risk.
   Establish a relevant baseline and distinguish existing failures from new ones.
2. Add or strengthen tests at the narrowest useful level. Invoke production
   functions, hooks, or components; do not recreate their implementation inside
   the test. Mock external transport when appropriate and name that boundary.
3. For a reproducible bug, show the regression test fails with the bug and
   passes after the fix where feasible. Perform intentional breakage only in
   a disposable local copy and restore it before delivery.
4. Run focused tests while iterating. Before handing off a behavior change,
   run the relevant broader checks and inspect failed, skipped, and unrun cases.
   Documentation and cosmetic edits need only proportionate verification.
5. Report commands, outcomes, baseline differences, and remaining gaps.
   Never describe a skipped or unexecuted critical journey as passing.
   Do not remove, weaken, or skip assertions merely to obtain green results;
   changed requirements must explain changed expectations.
6. Work on a branch and preserve the Regression gate. Before any release,
   verify isolated persistence and live speech on the candidate revision,
   including the backend functions, and state the actual deployment path.
   A workflow file or proposed ruleset is not proof that branch protection is active.

## Test and data boundaries

- `bun run test:watch`: fast feedback while coding.
- `bun run qa`: gate/handler and isolation checks, lint, unit/component tests,
  type checks, public browser and synthetic-microphone journeys. Public checks
  have no real backend; controlled speech responses do not prove live Azure accuracy.
- `bun run qa:release`: the above plus mandatory authenticated therapy and
  deployed speech tests against an explicitly isolated backend. Missing
  prerequisites fail the run. This is not a clinical or real-device sign-off.
- Do not authenticate or write test data against production. Validate the
  test origin and key before creating a client, and keep the browser build and
  verification client on the same approved test backend.
- Preserve the clinical freeze in `.lovable/qa-hardening.md`: testing work does
  not authorize speculative changes to scoring, progression, mastery routing,
  speech behavior, drill selection, or content banks.
- Controlled AI responses verify application handling. Prompt/model quality
  needs representative evaluation cases against agreed criteria. Neither kind
  of automated check establishes clinical efficacy or real microphone quality.
- For microphone, audio, or accessibility changes, record any needed real-device
  check separately from browser emulation and mocked speech tests.

The optional NeuroSpark Regression Testing personal skill expands this workflow.
Explain tests when useful; do not require a course or quiz before implementation.
