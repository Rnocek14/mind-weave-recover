## Test scripts (Lovable convenience)

The `package.json` scripts list is curated by Lovable and is intentionally
small. To run the full check suite locally (matches CI):

```bash
bun run lint
bunx vitest run
bunx tsc --noEmit
```

The CI workflow at `.github/workflows/ci.yml` runs the same three steps on
every PR and on pushes to `main`. The leveling contract suites
(`src/lib/leveling/__tests__/*`) are part of the default `vitest run`
selection and gate merges on:

  - **Slug / weight / heuristic sanity** — `perGameContracts.test.ts`
  - **Bank coverage vs FLOOR=15** — `contentCoverage.test.ts`
    Any contract marked `contentReadiness: 'ready'` whose actual content bank
    has a tier under 15 items will fail the build. Either expand the bank or
    downgrade the contract — never silently weaken the test.
