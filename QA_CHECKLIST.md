# QA Checklist

> **Phase 1 update:** the manual checklist has moved into the in-app
> guided runbook at **`/dev/qa-runbook`** (admin-only). It reads from
> [`src/data/qaScenarios.ts`](src/data/qaScenarios.ts), logs pass/fail/skip
> results to the `qa_runs` table, and exports a Markdown summary.

> **Release policy:** [current release readiness](docs/qa/release-readiness.md)
> distinguishes the Regression gate from live-service, persistence, device, and
> clinical validation. The Pages release workflow requires same-revision CI and
> isolated therapy verification; Lovable/manual deployment routes and active
> branch protection require separate confirmation. Do not claim every game is
> tested from aggregate test counts.

## Full QA workflow

1. **Automated**
   ```bash
   bun run qa
   # = gate/handler/isolation checks + lint + vitest + typecheck + public and speech browser checks
   ```
2. **Required before release** - use an explicitly isolated backend and run
   `bun run qa:release`, or run the `Isolated therapy verification` workflow
   on the revision being released. Missing prerequisites or skipped required
   journeys are incomplete verification. Public checks do not verify saving.
   See [regression workflow](docs/qa/regression-workflow.md) for configuration
   and [release readiness](docs/qa/release-readiness.md) for current enforcement.
3. **Manual (guided)** - use the isolated app's `/dev/qa-runbook`, set role +
   device, walk the scenarios, and record Pass/Fail/Skip. `Save run` writes to
   `qa_runs`; keep automated/synthetic runs out of the patient backend. Export
   a Markdown summary with its candidate revision and device.

## Quick reference

| Layer | Source of truth | Where to run |
|---|---|---|
| Unit + per-slug contract tests | `src/**/*.test.ts(x)` | `bun run test` |
| Per-game leveling contract registry | `src/lib/leveling/perGameContracts.ts` (spec-only; not live wiring evidence) | `/dev/leveling-contract` |
| Public UI and signed-out boundaries (inert backend) | `tests/e2e/*` public suite | `bun run test:e2e` |
| Microphone capture and controlled speech journeys | `tests/e2e/speech/*` | `bun run test:e2e:speech` |
| Speech metrics and analysis contracts | `src/lib/speech/*` and speech hook/component tests | `bun run test:speech` |
| Actual speech HTTP handler contracts (controlled Azure) | `scripts/speech-edge-handlers.test.mjs` | `bun run test:speech:handlers` |
| Fail-closed workflow results | `scripts/qa-gates.test.mjs` | `bun run test:qa-gates` |
| Deployed speech services (isolated backend) | `scripts/verify-speech-services.mjs` | `bun run test:speech:services` |
| Authenticated therapy and persistence (isolated backend) | `tests/e2e/core-loop.spec.ts` + authenticated journeys | `bun run test:e2e:staging` |
| Test-environment isolation | `scripts/e2e-environment.test.mjs` | `bun run test:test-env` |
| Guided manual runbook | `src/data/qaScenarios.ts` | `/dev/qa-runbook` on isolated app |
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
