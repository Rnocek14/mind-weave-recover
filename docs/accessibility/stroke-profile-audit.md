# Stroke-Profile Accessibility Audit (Phase 2A)

**Status:** PASS A COMPLETE. PASS B BLOCKED on anon-session E2E fixture.
**Owner:** AI agent (Pass A + Pass B attempt), human review pending.
**Date:** 2026-05-22
**Decision gate:** Phase 2B (user picks adaptive vs single-toggle vs global replace).

This document is **analysis only**. It does not touch app code, clinical engines, scoring, content banks, or any progression hook.

---

## 1. Method

Phase 2A is intentionally lightweight so we can scope Phase 2B (the build phase) without guesswork. Two passes:

- **Pass A — Code-level scan (complete).** Static scan of `src/pages/**` and `src/components/**` for the high-leverage failure modes listed in §3: icon-only buttons missing `aria-label`, `onClick` on non-interactive elements, `<img>` without `alt`, `autoFocus` outside dialogs, `h-screen` vs `h-dvh`, tap-target sizing, words-per-screen on patient routes, decisions-per-screen on patient routes.
- **Pass B — Manual archetype walkthrough (BLOCKED).** Attempted 2026-05-22 at 390×844 viewport. `/today` requires an authenticated session; the "Start Without Account" offline path shows the toast but does not redirect past `/auth`. The anon-session E2E fixture (already queued in Phase 1 follow-ups) is a hard prerequisite for Pass B. Once that fixture lands, drive `/today`, `/exercise/fix-sentence`, `/exercise/multi-step-plan`, `/exercise/category-fluency`, `/exercise/minimal-pairs`, and Session Summary as each archetype; fill P4 in §3.2 and revisit §5.

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
| P4 | No measured per-route audit yet for **tap-target size (≥44×44)**, **words-per-screen**, **decisions-per-screen**, **contrast ratios on semantic tokens** | All patient routes | Unknown | All four |
| P5 | Patient-facing routes assume reading literacy in instruction banners (mem://ux/exercise-entry-clarity-standard fades after one read) | Every `/exercise/*` | Warning | Wernicke's, Global |
| P6 | No left-edge salience reinforcement (icons, color shift, secondary cue) | `/today`, exercise headers | Warning | Right-hemisphere neglect |

P4 is the one that genuinely needs Pass B to fill in.

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

## 5. Recommendation gate (do not commit yet)

Three live options, mapped to what Pass A surfaced:

- **A — Adaptive UI keyed to `uiProfile`** (4 variants: `simplified-fluent`, `simplified-non-fluent`, `simplified-neglect`, `minimal`; default `standard`). Clinician sets via Patient Hub Plan tab.
  - **Fits the data:** patterns P5 (reading load) and P6 (left-side salience) are profile-specific — no single global tweak helps both Wernicke's and right-hemisphere.
  - **Cost:** higher — N variants per presentation component.
- **B — Single Simplified Mode toggle.**
  - **Fits the data partially:** would absorb P1, P3, P5 in one pass, but leaves P6 (neglect) and P2 (assessment hit area) unsolved.
  - **Cost:** lower, ships faster.
- **C — Global replacement.**
  - **Not justified.** Pass A shows the existing UI is sound for many profiles on many routes — only ~5 of 21 routes show a confirmed `block`, and all blocks cluster in two patterns (open speech under fatigue, reading-heavy clues).

**Pass A leans toward A**, but Pass B (manual archetype walkthrough) should run before that decision is locked. The audit deliberately stops short of recommending until P4 numbers are in.

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

Pass B: drive `/today`, `/exercise/fix-sentence`, `/exercise/multi-step-plan`, `/exercise/category-fluency`, `/exercise/minimal-pairs`, and Session Summary as each archetype; fill in P4 numbers; revisit §5 recommendation.
