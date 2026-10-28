# QA Checklist

> **Phase 1 update:** the manual checklist has moved into the in-app
> guided runbook at **`/dev/qa-runbook`** (admin-only). It reads from
> [`src/data/qaScenarios.ts`](src/data/qaScenarios.ts), logs pass/fail/skip
> results to the `qa_runs` table, and exports a Markdown summary.

## Full QA workflow

1. **Automated**
   ```bash
   bun run qa
   # = test-environment guards + lint + vitest + typecheck + public browser checks
   ```
2. **Required before release** — use an explicitly isolated backend and run
   `bun run qa:release`, or run the `Isolated therapy verification` workflow
   on the revision being released. Missing prerequisites or skipped required
   journeys are incomplete verification. Public checks do not verify saving.
   See [regression workflow](docs/qa/regression-workflow.md) for configuration.
3. **Manual (guided)** — open `/dev/qa-runbook`, set role + device, walk
   the scenarios, click Pass/Fail/Skip on each step, then `Save run` (to
   `qa_runs`) and/or `Download .md`.

## Quick reference

| Layer | Source of truth | Where to run |
|---|---|---|
| Unit + per-slug contract tests | `src/**/*.test.ts(x)` | `bun run test` |
| Per-game leveling contract registry | `src/lib/leveling/perGameContracts.ts` | `/dev/leveling-contract` |
| Mastery shadow snapshot | `/dev/mastery-shadow` | live |
| Public UI and signed-out boundaries (inert backend) | `tests/e2e/*` public suite | `bun run test:e2e` |
| Authenticated therapy and persistence (isolated backend) | `tests/e2e/core-loop.spec.ts` + authenticated journeys | `bun run test:e2e:staging` |
| Test-environment isolation | `scripts/e2e-environment.test.mjs` | `bun run test:test-env` |
| Guided manual runbook | `src/data/qaScenarios.ts` | `/dev/qa-runbook` |
| Stroke-profile accessibility audit (Phase 2A) | `docs/accessibility/stroke-profile-audit.md` | manual |

## What QA does NOT touch

The clinical freeze remains in force. Regression-test work does **not**
authorize speculative changes to these production behaviors:

- `src/hooks/use*Progression.ts`
- `src/hooks/use*Game.ts`
- `src/lib/responseValidation.ts`, scoring, mastery routing
- Speech pipeline / TTS / mic state machine
- Smart Coach turn pipeline / drill triggers
- Content banks (`src/data/*Bank.ts`)

If a QA gap requires changing those behaviors, capture a reproduction and
follow the clinical scope rules in `.lovable/qa-hardening.md`. Test fixtures may
create synthetic records only in the explicitly isolated environment; never
change production data or authentication settings to make a test run.
