## Phase 1.5 — Fix Sentence: true per-cell health (before Phase 2)

You're right to pause. The 5 "flaky" failures in `contentDistinctness.test.ts` are **not flakes** and **not unrelated** — they're real per-cell content gaps in `fixSentenceBank.ts` that the tier-rollup audit was hiding. Fixing these before Phase 2 is the right call.

### What's actually happening

The Fix Sentence selector switched to an **intensity-cohort** model (May 2026). At each engine level it picks one or two `errorType` cohorts (semantic_swap / category_error / function_error / multiple_valid_repairs) and then slices that cohort by sub-tier. The bank still labels every item with `difficulty: 1|2|3` (the legacy tier).

Current bank cells (errorType × tier):

```text
                         T1   T2   T3
semantic_swap             1   17    0
category_error           17    0    0
function_error            0    0   18
multiple_valid_repairs    3    3    2
```

The contentDepth audit only looks at the **tier rollup** (T1=21, T2=20, T3=20 — all "healthy"). But the *selector* asks for a single cohort at a time, so the real failures are:

- L1 selector → `category_error` only → 17 items (test asserted ≥20) ❌
- L10 selector → mixes `function_error` + `multiple_valid_repairs` → returns items with `difficulty: 2` and `1` (test asserted strict tier-3) ❌
- L4/L7 cohort slicing pulls neighbors → tier-2 purity breaks ❌
- L1→L8 re-pool overlaps cohorts → cross-tier purity breaks ❌

This is exactly the "tier-healthy ≠ per-cell-healthy" gap you flagged. Phase 2 (sentence-construction) would inherit the same audit blind spot.

### Plan

**Step A — Extend the audit to per-cohort sub-cells (fix-sentence specifically).**
Add a `fixSentencePerCohort()` report in `contentDepthAudit.test.ts` printing `errorType × tier` counts. Floor = 8 per cohort cell that an implemented level actually uses; aspirational cells (L5–L8 `two_error`, `mixed_morphology`, `embedded_clauses`, `open_ended_repair`) stay empty and are documented as such. This is the same per-bank-diff discipline you asked for, applied to the cohort axis Fix Sentence uses.

**Step B — Top up the under-floor cohort cells with real items (no invented schemas).**
Only the cells reachable by the *implemented* levels (L1–L4):

| Cell | Now | Target | Add |
|---|---|---|---|
| T1/semantic_swap | 1 | 8 | +7 |
| T1/multiple_valid_repairs | 3 | 8 | +5 |
| T2/multiple_valid_repairs | 3 | 8 | +5 |
| T3/multiple_valid_repairs | 2 | 8 | +6 |
| T1/category_error | 17 | 20 | +3 |
| T3/function_error | 18 | 20 | +2 |

Total: **~28 new Fix Sentence items**, one file, written in the existing bank style with proper `wrongWordIndex`, `phonemeTargets`, `errorType`, `difficulty`. No new schema, no aspirational L5–L8 content (those stay honestly empty — selector already skips them).

**Step C — Update the 5 stale assertions in `contentDistinctness.test.ts` to the current selector contract.**

- "engine L10 is exclusively tier 3" → "engine L10 returns ≥80% items from its declared cohort(s) and 0 items leaked from L1's cohort." (matches intensity model)
- "L4 and L7 are exclusively tier 2" → "L4 and L7 share the `function_error` cohort and overlap ≥ X%."
- "each tier ≥20 trials" → "each (cohort × tier) cell used by an implemented level has ≥8 items." (the real contract)
- "L1→L8 re-pool returns 100% new tier-3 trials" → "L1→L8 re-pool returns 0 repeats and items from L8's declared cohort(s)."

The replacement assertions are stricter than the originals because they test the contract the selector actually enforces.

**Step D — Re-run audit + distinctness suite, confirm green, then start Phase 2 (sentence-construction).**

### What does NOT change

- Engine, hooks, bridges, level specs, `implementedCeiling`, recency logic, scoring — all untouched.
- L5–L8 stay aspirational (selector skips honestly, ceiling clamps).
- Minimal-pairs d4/d5, phonological d6–d10 — still deferred per Wave 2 scope.
- Other games — no changes from this step.

### Risk

Lowest. Pure content + test-contract honesty. The only judgment call is the per-cohort floor of 8 (vs the 20 we use for per-tier). Eight matches `slice.count * 3` in the selector's cohort sizing — anything less and `sliceCohortByIntensity` falls back to neighbors, which is the bug we're closing.

### After this

Phase 2 (sentence-construction +~55 items d4–d10) proceeds with the per-bank-diff audit extended the same way — verifying real per-cell health instead of tier rollups.
