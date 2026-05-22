# Two-Phase Plan: Full QA + Stroke-Adaptive Accessibility

## 🔒 Hard guarantee: zero changes to game logic or app logic

This plan is **additive only**. Nothing in it modifies:

- The 13 wired progression engines (`use*Progression.ts`)
- `drillTriggerEvaluator.ts`, `drillSelector.ts`, `responseValidation.ts`
- `masterySignalRouting.ts` or the `ADOPTED_TRIAL_MODE_SLUGS` allowlist
- Adaptation engine, mastery confidence gate, cue-dependency safety gate, soft-regression scaffold
- Speech pipeline, TTS sync, mic state machine
- Smart Coach turn pipeline, Maya orchestration, session arc
- Any `src/data/*Bank.ts` content bank
- Any `src/lib/**` business logic file
- Routing, role-mode logic, RLS, edge functions' clinical logic

**What this plan IS allowed to touch:**
- New test files (`*.test.ts`, `*.spec.ts`, Playwright specs) — read-only against the app
- New dev-only routes (`src/pages/dev/QaRunbook.tsx`) — gated, not in patient nav
- New non-clinical tables (`qa_runs`) — additive migration
- New presentation-layer wrappers (Phase 2C) that READ a `uiProfile` field and choose a CSS variant — never alter behavior, validation, scoring, or progression

Any file in `src/lib/` (clinical engines), `src/hooks/use*Progression.ts`, `src/hooks/use*Game.ts`, and `src/data/*Bank.ts` is **off-limits** for both phases.

---

## PHASE 1 — Full QA (Manual + Automated)

**Goal:** verify every wired game, session flow, and role mode before any new feature work.

### 1A. Automated layer (read-only against app)

**Vitest (extend existing suite)**
- Per-game progression contract tests — one file per wired slug (13 games). Asserts level-up fires at success band, regression on struggle, recency holds, cue-gate blocks unsafe UP, bank depth ≥ FLOOR. **Tests only — engines untouched.**
- Role-routing tests — `setUiMode('clinician')` → `/clinician/review`, admin → `/admin`, etc.
- Maya overlay visibility tests across coaching modes.
- Session resume 4h guard test.

**Playwright E2E (new test framework, not app code)**
- Add `playwright.config.ts`, `@playwright/test` dev dep, CI job.
- 5 critical journeys (auth → session → summary; patient Guided lesson; caregiver photo upload; clinician note; admin pipeline view).
- Chromium + Mobile Safari viewport.

### 1B. Manual guided runbook (new dev-only page)

Build `/dev/qa-runbook` — interactive checklist, **dev-only route**, never in patient nav.
- Reads from `qaScenarios.ts` (new data file, not a logic file).
- Each step: what to do · what to look for · pass/fail/skip.
- Logs to new `qa_runs` table (additive migration, RLS = own rows).
- Generates a Markdown summary at end (replaces hand-filled `QA_CHECKLIST.md`).

### 1C. CI wiring

- `bun run lint && bunx vitest run && bunx tsc --noEmit && bunx playwright test` on PR.
- Nightly mastery-health snapshot job (uses existing queries in `docs/mastery-health-runbook.md`).

### Phase 1 deliverables
1. `playwright.config.ts` + 5 E2E specs + CI job update
2. ~15 new vitest files (per-slug contracts + role routing)
3. `src/pages/dev/QaRunbook.tsx` + `qaScenarios.ts` + `qa_runs` table migration
4. Updated `docs/ci.md`; `QA_CHECKLIST.md` points to runbook

---

## PHASE 2 — Stroke-Adaptive Accessibility

**Insight from feedback:** simplification can't be one-size-fits-all. UI should **adapt to stroke profile**, not flatten everyone.

### 2A. Audit only (no UI changes shipped, ~3–5 days)

Pure analysis — produces a document, touches no app code.

- Run axe-core via Playwright on every patient route.
- Tap-target audit (44×44 min, 60×60 target).
- Reading-load audit (words/screen, Flesch-Kincaid, decisions/screen).
- Contrast audit on semantic tokens.
- Clinical mapping against 4 stroke archetypes:

| Profile | Primary deficits | UI failure modes to look for |
|---|---|---|
| Broca's / non-fluent | Effortful speech, agrammatism | Speech-required flows punish; reading OK |
| Wernicke's / fluent | Comprehension impaired, paraphasias | Text instructions fail; needs icon+demo+voice |
| Right-hemisphere | Left neglect, attention | Left-side controls missed; multi-column fails |
| Global / severe | All modalities, fatigue | Needs single-tap journeys, zero reading |

**Deliverable:** `docs/accessibility/stroke-profile-audit.md` with findings, severity, screen-by-screen scorecard. **No code changes.**

### 2B. Decision gate (you approve before any UI work)

Present audit findings. Pick:
- **A** — adaptive UI keyed to a new `uiProfile` field (4 variants), set by clinician
- **B** — single Simplified Mode toggle
- **C** — global replacement (only if audit shows >70% failure for current UI)

Nothing builds until you decide.

### 2C. Build (after your decision)

Presentation-layer only. Pattern:

```
useUiProfile() → returns { profile, density, readingLoad, tapSize, primaryInputMode }
                          ↓
Wrapped UI components read the profile and pick a className variant
                          ↓
NO change to game state, validation, scoring, progression, mastery, Maya turn logic
```

Sub-phases:
- **2C-i** Patient home (`/today`) + session entry
- **2C-ii** Inside-exercise chrome (instructions, pause, summary)
- **2C-iii** Maya bubble + voice-led flows

Profile assignment: clinician sets in Patient Hub Plan tab. Defaults to `standard`. Patient never sees a toggle.

**What 2C does NOT touch:**
- `use*Progression.ts` — untouched
- `use*Game.ts` — untouched
- `responseValidation.ts`, scoring, mastery routing — untouched
- Speech pipeline / TTS / mic logic — untouched
- Smart Coach pipeline / drill triggers — untouched
- Content banks — untouched

Only chrome (cards, buttons, layout, copy density) gets a profile-aware variant.

---

## Sequencing

```text
Week 1   Phase 1A (vitest expansion)        Phase 2A (audit start)
Week 2   Phase 1B (runbook UI)              Phase 2A finish + report
Week 3   Phase 1C (CI + E2E) + manual QA    Phase 2B decision gate
Week 4+  → Phase 2C build (only if approved at gate)
```

Phase 1 fully ships before Phase 2C touches any patient UI.

---

## Explicitly out of scope

- Touching wired game clinical logic
- Wiring the 3 aspirational discourse games (separate backlog)
- Clinician/admin UI simplification
- i18n / new languages
- Any change to `ADOPTED_TRIAL_MODE_SLUGS`, mastery routing, or progression contracts

---

## Technical notes

- E2E auth: Supabase anon sign-in to avoid managing test credentials.
- `qa_runs` schema: `id`, `user_id`, `build_sha`, `role`, `device_label`, `scenario_id`, `step_id`, `result`, `note`, `recorded_at`. Indexed on `(build_sha, role)`. RLS: own rows only.
- `uiProfile` field (Phase 2C only, after decision): added to `profiles` via additive migration; default `'standard'`. RLS: patient reads own, clinician reads/writes assigned patients.
- Audit uses `@axe-core/playwright` — no new test stack beyond Playwright.
- Stroke-profile rendering branches on the profile field only — never on role, never on game state.
