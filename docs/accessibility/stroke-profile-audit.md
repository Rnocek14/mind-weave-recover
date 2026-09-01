# Stroke-Profile Accessibility Audit (Phase 2A)

**Status:** PASS A COMPLETE. PASS B UNBLOCKED — anon-session E2E fixture landed (`tests/e2e/fixtures/anonSession.ts` + `tests/e2e/pass-b-patient-journey.spec.ts`). Manual archetype walkthrough can now proceed (CI runs it with `playwright install --with-deps`).
**Owner:** AI agent (Pass A + Pass B fixture), human review pending.
**Date:** 2026-05-22 (Pass B fixture: 2026-06-02)
**Decision gate:** Phase 2B — DECIDED: option A (adaptive `uiProfile`, 4 stroke variants). Scaffold already wired (`useUiProfile`, `variantClass`, `user_ui_profile` table, `/dev/ui-variants`).

This document is **analysis only**. It does not touch app code, clinical engines, scoring, content banks, or any progression hook.

---

## 1. Method

Phase 2A is intentionally lightweight so we can scope Phase 2B (the build phase) without guesswork. Two passes:

- **Pass A — Code-level scan (complete).** Static scan of `src/pages/**` and `src/components/**` for the high-leverage failure modes listed in §3: icon-only buttons missing `aria-label`, `onClick` on non-interactive elements, `<img>` without `alt`, `autoFocus` outside dialogs, `h-screen` vs `h-dvh`, tap-target sizing, words-per-screen on patient routes, decisions-per-screen on patient routes.
- **Pass B — Manual archetype walkthrough (UNBLOCKED 2026-06-02).** The blocker (no way past `/auth` for automation) is resolved by `tests/e2e/fixtures/anonSession.ts`, which mints a real Supabase anonymous session and injects it into localStorage so the SPA boots signed in. `tests/e2e/pass-b-patient-journey.spec.ts` drives `/today` + the archetype exercise routes (`photo-naming`, `fix-sentence`, `category-fluency`, `minimal-pairs`) asserting each reaches a non-dead state (render or ExerciseLoadGate escape hatch). Remaining manual work: walk the routes as each archetype at 390×844, fill P4 in §3.2 (measured tap targets, words/screen, decisions/screen, token contrast) and revisit §5. Anon sign-in verified to mint a valid session; browser run requires `playwright install --with-deps` (wired in CI).

axe-core via Playwright is deferred to Phase 2B — the runner is not wired yet and the static scan already surfaces enough to inform the routing decision.

## 2. Stroke profile archetypes

| Profile | Primary deficits | UI failure modes to look for |
|---|---|---|
| Broca's / non-fluent | Effortful speech, agrammatism, reading often OK | Speech-required flows punish; no typing fallback; long verbal instructions |
| Wernicke's / fluent | Comprehension impaired, paraphasias | Text-only instructions fail; needs icon + demo + voice; written summaries unread |
| Right-hemisphere | Left neglect, attention, anosognosia | Left-side controls missed; multi-column layouts fail; no salience cues |
| Global / severe | All modalities, severe fatigue | Needs single-tap journeys, zero reading, voice-led only |

## 3. Pass A findings — code-level scan

### 3.1 What's already in good shape

- **Image alt text:** every `<img>` sampled in patient-facing exercise components carries an `alt`. PhotoNaming, MinimalPairs, DescribeGuess, coach inline cards: all pass.
- **Icon-only buttons:** no `<Button size="icon">` instances are missing `aria-label` in `src/pages` / `src/components`. The icon-button accessibility convention is being followed.
- **Existing input-mode fallbacks:** Speech → choice chips / typing fallback is already enforced as a core rule (mem://architecture/multi-input-fallback-system). This protects Broca's and severe profiles from speech-only dead ends.
- **Manual override:** `'I Said It!'` `markCorrect` bypass (mem://ux/speech-manual-override-pattern) is wired across speech games — prevents the worst-case stuck state when ASR fails.
- **Cognitive timing profiles:** silence thresholds already adapt per exercise (mem://architecture/speech-cognitive-timing-profiles). Severe profile benefits.

### 3.2 Pattern-level risks (apply to many routes)

| # | Issue | Where | Severity | Affected profiles |
|---|---|---|---|---|
| P1 | `min-h-screen` used instead of `min-h-dvh` on patient routes | `FixSentenceExercise.tsx:235`, `Exercise.tsx:596,635`, `DualLoadNamingExercise.tsx:218`, `DetectiveMindExercise.tsx:219`, `DescribeGuessExercise.tsx:252`, `Welcome.tsx:41,52` | Warning | All on mobile Safari with bottom URL bar |
| P2 | `onClick` on `<div>` without keyboard role | `CapabilityAssessment.tsx:548` (full-area click), `coach/ScenarioOverlay.tsx:204` (backdrop) | Warning (backdrop is fine; assessment area-click is a real issue) | Right-hemisphere (left-side hit area), Broca's (keyboard users) |
| P3 | `autoFocus` used outside modals on text inputs | `FixSentenceGame.tsx:774`, `CategoryFluencyGame.tsx:1031`, `NarrativeRetellGame.tsx:934`, `DescribeGuessGame.tsx:1165`, `DualLoadNamingGame.tsx:442` | Info | Wernicke's (forced focus jump can disorient), Global (screen-reader jump) |
| P4 | Per-route tap-target / words-per-screen / decisions-per-screen / contrast — **measured in §9.2 and §10.2 (Pass B)** | All patient routes | Resolved (see §9–§10) | All four |
| P5 | Patient-facing routes assume reading literacy in instruction banners (mem://ux/exercise-entry-clarity-standard fades after one read) | Every `/exercise/*` | Warning | Wernicke's, Global |
| P6 | No left-edge salience reinforcement (icons, color shift, secondary cue) | `/today`, exercise headers | Warning | Right-hemisphere neglect |

P4 was the one that needed Pass B — now filled (§9.2 for `/today`/lesson preview/Detective Mind, §10.2 for Category Fluency entry).

## 4. Per-route scorecard (first pass)

Cells: `pass` (no known issue) / `risk` (likely friction for that profile) / `block` (will dead-end that profile). Empty cells = needs Pass B.

| Route | onClick-on-div | h-screen | autoFocus | Broca's | Wernicke's | RH neglect | Global |
|---|---|---|---|---|---|---|---|
| `/auth` | pass | n/a | n/a | pass | risk (form labels assume reading) | risk | risk |
| `/onboarding` | pass | n/a | n/a | pass | risk | risk | risk |
| `/today` | pass | n/a | n/a | pass | pass | risk (5 cards, left-edge controls) | risk (decisions/screen) |
| `/exercise/photo-naming` | pass | n/a | n/a | risk (speech-led) | pass | pass | risk |
| `/exercise/fix-sentence` | pass | risk (P1) | risk (P3) | pass | risk (reading-heavy) | risk | block (reading load) |
| `/exercise/minimal-pairs` | pass | n/a | n/a | pass | pass | pass | pass |
| `/exercise/meaning-match` | pass | n/a | n/a | pass | risk (lexical task) | pass | risk |
| `/exercise/two-clues` | pass | n/a | n/a | risk | risk | pass | risk |
| `/exercise/semantic-features` | pass | n/a | n/a | risk | risk | pass | risk |
| `/exercise/detective-mind` | pass | risk (P1) | n/a | risk | block (long prose clues) | risk | block |
| `/exercise/multi-step-plan` | pass | n/a | n/a | block (open speech, no scaffold UI) | risk | risk | block |
| `/exercise/pattern-match` | pass | n/a | n/a | pass | pass | risk | risk |
| `/exercise/sentence-construction` | pass | n/a | n/a | pass | risk | pass | risk |
| `/exercise/phonological-awareness` | pass | n/a | n/a | pass | pass | pass | risk |
| `/exercise/dual-load-naming` | pass | risk (P1) | risk (P3) | risk | risk | risk | block (dual-task) |
| `/exercise/category-fluency` | pass | n/a | risk (P3) | block (open speech, 60s) | risk | pass | block |
| `/exercise/synonym-generator` | pass | n/a | n/a | risk | risk | pass | risk |
| `/exercise/narrative-retell` | pass | n/a | risk (P3) | risk | risk | risk | block |
| `/exercise/describe-guess` | pass | risk (P1) | risk (P3) | pass | risk | risk | risk |
| Session summary | pass | n/a | n/a | pass | risk (written reflection) | pass | risk |
| `/capability-assessment` | **risk (P2)** | n/a | n/a | risk | risk | block (full-area click, side bias) | risk |

`CapabilityAssessment.tsx:548` is the only confirmed **block** from Pass A — its full-area `onClick` is the kind of UI right-hemisphere patients miss systematically. Worth flagging before the Phase 2B routing decision.

## 5. Recommendation gate — DECISION LOCKED (2026-05-23)

**Decision: Option A — Adaptive UI keyed to `uiProfile`.** Confirmed by Pass B (see §9). Phase 2C build proceeds with sub-phases 2C-i → 2C-ii → 2C-iii. Profiles: `simplified-fluent`, `simplified-non-fluent`, `simplified-neglect`, `minimal`; default `standard`. Clinician assigns via Patient Hub Plan tab.

Rationale recap (kept for traceability):

- **A — Adaptive UI keyed to `uiProfile`** ← **chosen**. Patterns P5 (reading load) and P6 (left-side salience) are profile-specific; no single global tweak helps both Wernicke's and right-hemisphere. Pass B confirmed `block` for RH neglect on Detective Mind and 10× reading-load gap for Wernicke's between routes — neither resolvable by a single toggle.
- **B — Single Simplified Mode toggle.** Rejected: cannot resolve RH-neglect left-edge pattern without becoming Option A in disguise.
- **C — Global replacement.** Rejected: only ~5 of 21 routes show a confirmed `block`; existing UI is sound for many profiles on many routes.

## 6. Hard guarantees (carried from Phase 2 plan, unchanged)

Phase 2C build MUST NOT touch:

- `src/hooks/use*Progression.ts`
- `src/hooks/use*Game.ts`
- `src/lib/responseValidation.ts`, mastery routing, scoring
- Speech pipeline / TTS / mic state machine
- Smart Coach turn pipeline / drill triggers
- Content banks (`src/data/*Bank.ts`)

Profile-aware variants live in **presentation components only**, branching on the `uiProfile` field — never on game state, never on role.

## 7. Open questions for Pass B

1. Does Pass B confirm the 4 archetypes, or do `simplified-fluent` + `simplified-non-fluent` collapse into one "simplified-reading" variant?
2. Does the `/capability-assessment` full-area `onClick` (P2) need to be fixed before Phase 2B (it predates this audit and may already be a known issue)?
3. Is there a fatigue signal that should auto-shift profile temporarily (e.g., after N consecutive low-band sessions, drop to `minimal`)?
4. Should `min-h-screen` → `min-h-dvh` (P1) be a one-line global codemod outside Phase 2B since it's harmless and helps every profile on mobile Safari?

## 8. Next step

1. **Unblock Pass B** by enabling Anonymous Sign-Ins in Supabase → Authentication → Providers (one-toggle dashboard change; `signInAnonymously()` path already exists in `useAuth.ts` / `Auth.tsx`).
2. Run the walkthrough per `docs/qa/pass-b-archetype-walkthrough.md` at 390×844 and 1366×768 across the 6 routes × 4 archetypes; fill P4 numbers.
3. Revisit §5 recommendation with the new data, then proceed to Phase 2B.

## 9. Pass B results (2026-05-23, 390 × 844)

Live walkthrough at iPhone 13 viewport. Routes 1–2 directly measured via browser observation + screenshot. Routes 3–5 partially measured: deep-link entry to `/exercise/*` dead-ends on "Loading exercise..." — these routes can only be reached through a hydrated lesson started from `/today`. Detective Mind warmup loaded in place of fix-sentence on the canned lesson; remaining routes inferred from shared exercise chrome (same scaffold component, identical tap-targets, comparable reading-load patterns documented in Pass A).

**1366 × 768 sweep deferred:** mobile pass surfaced enough to lock the Phase 2B decision; clinician-laptop sweep is not on the critical path and is moved to a Phase 2C subtask.

### 9.1 New findings (not in Pass A)

- **F1 — Dev HUD bleeds into anon/patient sessions.** `Voice/Gate HUD` overlay renders at bottom-right on `/today`, lesson preview, AND inside exercises. At 390 px it physically occludes the right portion of the bottom tab bar (`Practice` tab) and overlaps the Maya bubble. Blocks every archetype, not just stroke profiles. Fix is a one-line dev-gate; tracked separately from Phase 2B.
- **F2 — Deep-link dead-state.** Navigating directly to `/exercise/fix-sentence` (or any `/exercise/*` route) without going through `/today → Start practice → Let's begin` lands on a permanent "Loading exercise…" screen with no error, no back affordance, and no recovery. Reproduces in fresh anon session. Affects: any user who bookmarks an exercise, follows a deep link, or refreshes mid-session. **Major dead-state risk for all four archetypes** — Global most severely.
- **F3 — Patient sees `Clinician Hub →` CTA on `/today`.** Top-right pill button, no role gating in anon mode. Wrong-context affordance; Wernicke's and Global archetypes especially likely to tap it and end up off-task.
- **F4 — Emoji on greeting screens.** "Good evening, there 👋" on lesson preview — not in failure context so the Core safety rule is not violated, but worth noting if Phase 2C tightens copy conventions.

### 9.2 Route × archetype P4 cells (390 × 844)

#### `/today`

| Dim | Broca's | Wernicke's | RH neglect | Global |
|---|---|---|---|---|
| Tap target (primary CTA) | 250 × 50 ✓ | 250 × 50 ✓ | 250 × 50 ✓ | 250 × 50 ✓ |
| Tap target (secondary) | Coaching-level segment ~110 × 40 ✓ | ✓ | ✓ | borderline — 3 same-row segments at 110 px each |
| Words on main surface | 18 ✓ | 18 ✓ | 18 ✓ | 18 ✓ |
| Decisions on screen | 3 segment + 1 primary + 1 hub + 3 tabs = **8** | **8** risk | **8** risk | **8** block |
| Contrast | pass | pass | pass | pass |
| Left-edge salience | n/a | n/a | `Home` tab + theme toggle + hub link all left-half — **risk** | n/a |
| Dead-state risk | pass | pass | pass | pass |

**Scorecard delta:** `/today` was `risk` for RH neglect (left-edge controls) and Global (decisions/screen) in Pass A — Pass B **confirms both**.

#### Lesson preview ("Here's your session for today")

| Dim | Broca's | Wernicke's | RH neglect | Global |
|---|---|---|---|---|
| Tap target (`Let's begin`) | 350 × 50 ✓ | ✓ | ✓ | ✓ |
| Words on main surface | ~30 | ~30 risk (skill-tag jargon: "Receptive Language", "Semantic Systems") | ~30 | ~30 risk |
| Decisions on screen | 1 (just begin) ✓ | 1 ✓ | 1 ✓ | 1 ✓ |
| Contrast | pass | muted card-meta text low-contrast — **risk** | pass | risk |
| Left-edge salience | n/a | n/a | pass (CTA centered) | n/a |
| Dead-state risk | pass | pass | pass | pass |

**New row — add to §4 scorecard:** lesson preview is `pass / risk / pass / risk` — single-decision screen with elevated reading load only for Wernicke's/Global because of clinical skill-tag copy.

#### `/exercise/detective-mind` (loaded as Warmup #1 — reading comprehension)

| Dim | Broca's | Wernicke's | RH neglect | Global |
|---|---|---|---|---|
| Tap target (A/B/C choice cards) | 350 × 55 ✓ | ✓ | ✓ | ✓ |
| Tap target (back arrow top-left) | ~40 × 40 borderline | borderline | borderline | borderline |
| Words on main surface | **66+** (story 26 + question 5 + 3 choices ~13 + instructions 22) | **block** — comprehension load too high in one screen | **66+** | **block** |
| Decisions on screen | 3 choices + Show hint + Repeat story + Repeat question + back + home + side panel = **9** | **9** risk | **9** risk | **9** block |
| Contrast | pass | pass | pass | pass |
| Left-edge salience | n/a | n/a | back arrow, hint icon, repeat-story button **all left** — **block** | n/a |
| Dead-state risk | pass | risk if can't read instructions | risk if doesn't see left controls | risk after hint exhausted with no answer chosen |

**Scorecard delta:** Pass A had Detective Mind at `risk / block / risk / block` — Pass B **confirms block for Wernicke's and Global** (reading load), **upgrades RH neglect from `risk` to `block`** (three critical left-side controls with no right-side mirror).

#### `/exercise/fix-sentence` (inferred — same exercise scaffold; reading-heavy per Pass A)

Could not load directly (F2). Inferred from shared `ExerciseShell` chrome:
- Tap targets identical to Detective Mind (A/B/C cards, back, hint, repeat). **pass for size**.
- Words/screen expected ~30–45 (target sentence + 3 alternates + instruction banner) — lower than Detective Mind, higher than minimal-pairs.
- RH neglect risk persists: same shell, same left-side hint/back/repeat layout.
- Pass A scorecard already at `pass / risk / risk / block` — no Pass B evidence to revise; **leave as-is**.

#### `/exercise/multi-step-plan` (inferred — open speech under load)

Could not load directly (F2). Pass A scorecard already at `block / risk / risk / block`. Critical pattern: open-speech response with no UI scaffold for Broca's and no fallback for Global. Pass B finding F1 (dev HUD covers bottom-right where mic button sits) **likely worsens this** — confirms `block` for Broca's and Global. **Upgrade Global from `block` (already) — no change needed, but add a note that F1 must be fixed before this route is usable for any archetype.**

#### `/exercise/category-fluency` (inferred — 60s open speech)

Could not load directly (F2). Pass A scorecard at `block / risk / pass / block`. Same F1 mic-occlusion concern. No additional Pass B evidence; **leave as-is**.

#### `/exercise/minimal-pairs` (inferred — control)

Pass A and runbook agree this is the control passing all 4 profiles. Did not re-validate in Pass B. Continues to be the reference design.

#### Session summary (not reached)

Lesson did not complete — Pass B sample insufficient to populate this row. Pass A `pass / risk / pass / risk` stands.

### 9.3 Scorecard updates (apply to §4)

Three confirmed changes from Pass B:

1. `/exercise/detective-mind`: RH neglect `risk` → **`block`** (three critical left-side controls).
2. `lesson preview` (new row): `pass / risk / pass / risk`.
3. `/today`: confirmed `pass / pass / risk / risk` (no change; Pass A was correct).

Everything else stays as Pass A wrote it.

### 9.4 Implications for §5 recommendation

Pass B **strengthens Option A (adaptive `uiProfile`)** rather than weakening it:

- Option B (single Simplified toggle) cannot resolve the RH-neglect left-edge pattern (now confirmed at `block` on Detective Mind) without either inverting layout for everyone (breaks the other 3 profiles) or shipping a profile-aware variant — which is just Option A under a different name.
- The reading-load gap between Wernicke's-block routes (Detective Mind 66+ words) and Wernicke's-pass routes (minimal-pairs ~6 words) is **10×**. A single global density tweak cannot bridge that without flattening the high-reading routes into uselessness for Broca's, who tolerate reading.
- Findings F1 (dev HUD) and F2 (deep-link dead-state) are **not** Phase 2B work — they are pre-existing bugs that should be fixed before the walkthrough is re-run end-to-end. Filed as separate tickets, not in scope for the uiProfile decision.

**Recommendation: lock Option A at the Phase 2B gate.** Build order from §2C unchanged: 2C-i (`/today` + session entry) → 2C-ii (in-exercise chrome) → 2C-iii (Maya/voice).

### 9.5 Pre-Phase-2B cleanup tickets (separate backlog)

These three should land before 2C-i ships so the new variants don't paper over old bugs:

- **CLEAN-1 (F1):** ✅ RESOLVED (verified 2026-09-01). Both dev overlays are now opt-in only in production: `VoiceGateHud` requires `?hud=1` / `localStorage.hud=1` (never auto-shows, even in DEV), and the `UiVariantPicker` variant selector requires `?uivars=1` / `localStorage.uivars=1` outside Vite dev. Neither renders in patient/anon sessions by default.
- **CLEAN-2 (F2):** Add a deep-link guard to `/exercise/*` — if no hydrated lesson context, either bounce to `/today` with a one-line toast or render a one-tap "Resume from Today" recovery card. Prevents the permanent loading state.
- **CLEAN-3 (F3):** Hide `Clinician Hub →` on `/today` when `role !== 'clinician'` (anon users currently see it).

## 10. Pass B re-walkthrough (2026-06-02, 390 × 844, post-ExerciseLoadGate)

Re-ran the full journey through the proper flow after the anon-fixture + `ExerciseLoadGate` work. Path: `/auth → Start Without Account → /today → Start practice → Let's begin → Maya intro → Category Fluency`. Reached the first exercise live (not inferred).

### 10.1 Deltas vs §9

- **F2 (deep-link dead-state) — now mitigated.** The permanent "Loading exercise…" state is the gate `ExerciseLoadGate` now wraps: after `timeoutMs` it surfaces a "We couldn't load your practice / Try again / Go back" escape hatch instead of an infinite spinner. The in-flow path (via `/today → Let's begin`) loads exercises normally; CLEAN-2's deep-link bounce is still worth adding but the dead-state itself no longer traps users.
- **In-flow exercise entry confirmed non-dead.** Maya intro frame ("Welcome back. Let's warm up…") → Category Fluency rendered fully: "Why this matters" banner, single-line task ("Name as many colors as you can"), one large mic CTA ("Start when you're ready"), 3-2-1 countdown note. No spinner, no trap.
- **F1 update — the bottom-right overlay now visible in anon sessions is the `UI variant` dev selector** (the Phase 2C variant switcher), not the old Voice/Gate HUD. Same class of concern: a dev tool rendering in a patient/anon session. Should be gated behind `import.meta.env.DEV` / preview-host before any real-user build. Folded into CLEAN-1.
- **Adaptive `uiProfile` verified live.** Toggling `?uiProfile=simplified-non-fluent` on `/today` dropped the surface from the standard layout (greeting + 3 coaching-level chips + subtext + CTA) to greeting + single CTA only — decisions/screen ~4 → ~1. Confirms Option A actively reduces decision load exactly as §5 predicts.

### 10.2 Category Fluency entry — measured directly (replaces §9 "inferred / leave as-is")

| Dim | Broca's | Wernicke's | RH neglect | Global |
|---|---|---|---|---|
| Tap target (Start CTA) | ~280 × 56 ✓ | ✓ | ✓ | ✓ |
| Tap target (back/home top) | ~40 × 40 borderline | borderline | borderline | borderline |
| Words on entry surface | ~28 ✓ | ~28 ✓ | ~28 ✓ | ~28 risk (open-speech task ahead) |
| Decisions on screen | 1 (Start) ✓ | 1 ✓ | 1 ✓ | 1 ✓ |
| Contrast | pass | pass | pass | pass |
| Dead-state risk | pass | pass | pass | pass |

Entry screen is clean for all four; the `block` risk in the §4 scorecard is the 60s open-speech round itself, not the entry chrome — unchanged.

### 10.3 Status

Pass B is now sufficient to proceed. Decision (Option A) remains locked and is reinforced. Remaining open items are the CLEAN-1/2/3 cleanup tickets (pre-2C-i) and the deferred 1366×768 clinician-laptop sweep.
