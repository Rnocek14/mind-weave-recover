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

| `/insights` | ✅ pass | Safe "building baseline" empty states, concern banner |
| `/history` | ✅ pass | QA session logged correctly (1 try, 0%, photo_naming) |
| `/recovery-progress` | ✅ pass | BETA, clinical-safe empty states |
| `/speech-profile` | ✅ pass | Empty state + Profile/Adaptation/Evidence tabs |
| `/photo-library` | ✅ pass | Empty state + Take Photo / Upload CTAs |

### Fixes applied (presentation-only, engine untouched)
- **Insights mobile tabs**: first-word split produced ambiguous "What's"/"What".
  Added explicit `shortLabel` (Hard / Helps / Intel) — `src/pages/Insights.tsx`.
- **Recovery Progress cards**: long patient status sentence in a `shrink-0`
  group crushed the title column on mobile; header now stacks below `sm` —
  `src/pages/RecoveryProgress.tsx`.

### Observations (polish backlog, not defects)
- During choice-audio playback the answer chips are `disabled`; tapping one is
  silently ignored with no "wait" affordance (re-enables after audio).
- Mic-denied "Could not start recording" toast re-fires every trial; candidate
  for once-per-session suppression.

### Guided lesson drive-through (live, 390px, anon) ✅
Plan → session → 3 exercises driven end-to-end with the user.

| Flow | Status | Notes |
|------|--------|-------|
| Session plan screen | ✅ pass | Clinical arc (Warm-up→Core→Stretch→Cool-down), per-block "why", ~15m/6 blocks |
| Maya intro transition | ✅ pass | "Let's warm up…" calm, no celebration |
| Category Fluency | ✅ pass | Auto typing-fallback (no mic), live word validation |
| → validation | ✅ pass | "red" accepted (✓), off-category "table" rejected (✗ strikethrough, not counted) |
| → round/category variety | ✅ pass | foods→colors→clothing, examples + countdown refresh each round |
| → "Done early" + timer | ✅ pass | Advances round; 3-2-1 countdown between rounds |
| Inter-exercise transition | ✅ pass | "That warmed up your word-finding speed…" contextual bridge |
| Describe & Guess | ✅ pass | Purpose banner, cue chips (Use/Where/Looks like), typing fallback |
| → AI guesser + scoring | ✅ pass | Maya guessed sneaker from description; star/target counters increment |
| → Skip path | ✅ pass | Skips trial cleanly through 8/8, then transitions out |
| Detective Mind | ✅ pass | Reading comp, rank progression (Rookie→Junior Detective), +pts |
| → reasoning feedback | ✅ pass | "Case solved" shows explicit why; hint option costs −5 pts |
| → auto-advance cases | ✅ pass | Case 1→2 advances without dead state |

### Fixes applied (presentation-only, engine untouched)
- **Category Fluency clothing label**: tier label `'Clothing'` produced
  ungrammatical "Name as many clothing as you can". Changed to
  `'Clothing Items'` (the `category: 'clothes'` validation key is unchanged) —
  `src/components/CategoryFluencyGame.tsx`.

### Observations (polish backlog, not defects)
- Describe & Guess cue chips vary per trial (2 vs 3 chips); confirm this is the
  intended adaptive cue-fade rather than content gaps.

### Remaining patient routes to drive (need real mic/audio)
Minimal Pairs (audio discrimination) and Narrative Retell (discourse speech) —
best driven live by the user with a real microphone/speakers to exercise the
speech + audio pipelines. Photo Naming already validated standalone.

---

## Phase 2–6
Not started. See `.lovable/plan.md` / initiative plan for scope.
