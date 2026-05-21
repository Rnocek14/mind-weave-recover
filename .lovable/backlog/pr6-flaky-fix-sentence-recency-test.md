# Backlog: Flaky `fixSentenceRecency` test

**Created during PR6 (Phase 2.5). Not a blocker for PR6.**

## Symptom
`src/hooks/__tests__/fixSentenceRecency.test.ts` is intermittently flaky.
Suspected sources of nondeterminism:

- `getFixSentenceTrials` shuffles its pool via `Math.random()` before
  applying recency filtering. With small banks, shuffle order can flip
  the relative position of "fresh" vs "recent" items the test asserts on.
- Recency state is read from `localStorage` via `useRecencyExclusion`.
  If a sibling test leaks state (no `localStorage.clear()` in
  `beforeEach`), the LRU queue starts non-empty.
- The hook captures `initialRecentIds` once per mount; tests that
  re-render with new options will still see the first snapshot.

## Suggested fix (deferred)

1. Inject a seeded RNG into `getFixSentenceTrials` (`opts.rng?`) and
   pass a deterministic seed from the test.
2. Add a shared test helper that calls `localStorage.clear()` and
   `sessionStorage.clear()` in `beforeEach` for any recency test.
3. Tighten the test assertions to be order-insensitive when the only
   guarantee is "fresh items are preferred over recent", not "fresh
   items appear in this exact order".

## Why we are not fixing now

PR6 scope is "Fix Sentence L5–L8 content tiers". Touching the recency
shuffle path risks regressing PR3's cue-dependency gate and PR5's
recency contract. Track here and pick up before PR7.

## Owner

Unassigned. Pick up after the PR4 probe-bank cleanup ticket.
