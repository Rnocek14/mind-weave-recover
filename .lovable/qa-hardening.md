# QA Hardening Initiative — Master Tracker

Started: 2026-06-03
Owner: Lovable + user (user drives live preview, Lovable fixes + documents)

## Guardrails (do not violate)
Clinical engine is **frozen**. No changes to scoring, progression, mastery
routing, drill selection, speech pipeline, or content banks unless a defect is
**confirmed with a clear repro**. Speculative edits to `use*Game.ts`,
`use*Progression.ts`, `responseValidation.ts`, or `*Bank.ts` are forbidden.

---

## Phase 0 — Foundation & baseline ✅

| Check | Result |
|-------|--------|
| Vitest + RTL infra | ✅ present (`vitest.config.ts`, `src/test/setup.ts`) |
| Test suite baseline | ✅ **1108 passing, 25 skipped, 74 files** (`bunx vitest run`) |
| Playwright e2e infra | ✅ present (`playwright.config.ts`, `tests/e2e/*`) |
| Guided runbook | ✅ `/dev/qa-runbook` reads `src/data/qaScenarios.ts` |
| Known flaky test | `fixSentenceRecency` — backlog `pr6-flaky-fix-sentence-recency-test.md` |

Baseline console errors (patient, anon sign-in): only expected
`NotFoundError: Requested device not found` (no microphone in headless QA
browser). No unexpected runtime errors.

---

## Phase 1 — Patient sweep (in progress)

Method: anonymous sign-in ("Start Without Account"), 390×844 mobile viewport.

| Route / flow | Status | Notes |
|--------------|--------|-------|
| `/auth` | ✅ pass | Email/pw form, "Start Without Account", no console errors |
| `/today` (home) | ✅ pass | Greeting, coaching-level selector, Start CTA, bottom tab bar |
| Practice tab | ✅ pass | Suggested + categorized games render cleanly |
| `/exercise/photo-naming` | ✅ pass | Loads, instruction banner, image preloads |
| → mic-denied fallback | ✅ pass | "Hear choices" reveals choice chips (multi-input fallback per memory) |
| → chip scoring + advance | ✅ pass | Tapping a chip scores and auto-advances to next trial |
| → stall auto-cue | ✅ pass | Stall detected → semantic cue delivered, no dead state |

### Observations (polish, not defects)
- During choice-audio playback the answer chips are `disabled`; tapping one in
  that window is silently ignored with no visual "wait" affordance. Low-priority
  UX polish — **not** a dead state (button re-enables after audio).
- The "Could not start recording / check microphone permissions" toast re-fires
  on every trial in a fully mic-denied environment. Real, but the documented
  fallback (choice chips) is always available. Candidate for once-per-session
  suppression — backlog, not a blocker.

### Remaining patient routes to drive
`/insights`, `/history`, `/photo-library`, `/speech-profile`,
`/recovery-progress`, `/lesson` (full guided session), remaining `/exercise/*`.

---

## Phase 2–6
Not started. See `.lovable/plan.md` / initiative plan for scope.
