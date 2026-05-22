# QA Checklist

> **Phase 1 update:** the manual checklist has moved into the in-app
> guided runbook at **`/dev/qa-runbook`** (admin-only). It reads from
> [`src/data/qaScenarios.ts`](src/data/qaScenarios.ts), logs pass/fail/skip
> results to the `qa_runs` table, and exports a Markdown summary.

## Full QA workflow

1. **Automated**
   ```bash
   bun run qa
   # = lint + vitest + tsc --noEmit + playwright e2e
   ```
2. **Manual (guided)** — open `/dev/qa-runbook`, set role + device, walk
   the scenarios, click Pass/Fail/Skip on each step, then `Save run` (to
   `qa_runs`) and/or `Download .md`.

## Quick reference

| Layer | Source of truth | Where to run |
|---|---|---|
| Unit + per-slug contract tests | `src/**/*.test.ts(x)` | `bun run test` |
| Per-game leveling contract registry | `src/lib/leveling/perGameContracts.ts` | `/dev/leveling-contract` |
| Mastery shadow snapshot | `/dev/mastery-shadow` | live |
| E2E smoke (public routes) | `tests/e2e/smoke.spec.ts` | `bun run test:e2e` |
| Guided manual runbook | `src/data/qaScenarios.ts` | `/dev/qa-runbook` |
| Stroke-profile accessibility audit (Phase 2A) | `docs/accessibility/stroke-profile-audit.md` | manual |

## What QA does NOT touch

By policy (per the approved Phase 1/2 plan), QA tooling and the upcoming
accessibility work do **not** modify:

- `src/hooks/use*Progression.ts`
- `src/hooks/use*Game.ts`
- `src/lib/responseValidation.ts`, scoring, mastery routing
- Speech pipeline / TTS / mic state machine
- Smart Coach turn pipeline / drill triggers
- Content banks (`src/data/*Bank.ts`)

If you find a QA gap that would require touching one of those files,
file a backlog note in `.lovable/backlog/` instead of patching directly.
