# Stroke-Profile Accessibility Audit (Phase 2A)

**Status:** SKELETON — populated during Phase 2A audit run.
**Owner:** TBD
**Decision gate:** Phase 2B (user picks adaptive vs single-toggle vs global replace).

This document is **analysis only**. Filling it in does not touch app code.

---

## 1. Method

- axe-core via Playwright on every patient route
- Tap-target audit (44×44 min, 60×60 target)
- Reading-load audit (words/screen, Flesch-Kincaid, decisions/screen)
- Contrast audit on semantic tokens (HSL pairs in `index.css`)
- Manual archetype walkthrough (4 profiles below) on `/today`, `/exercise/*`, summary

## 2. Stroke profile archetypes

| Profile | Primary deficits | UI failure modes to look for |
|---|---|---|
| Broca's / non-fluent | Effortful speech, agrammatism, reading often OK | Speech-required flows punish; no typing fallback; long verbal instructions |
| Wernicke's / fluent | Comprehension impaired, paraphasias | Text-only instructions fail; needs icon + demo + voice; written summaries unread |
| Right-hemisphere | Left neglect, attention, anosognosia | Left-side controls missed; multi-column layouts fail; no salience cues |
| Global / severe | All modalities, severe fatigue | Needs single-tap journeys, zero reading, voice-led only |

## 3. Per-route scorecard (to fill)

| Route | axe critical | axe serious | <44×44 targets | Words/screen | Decisions/screen | Broca's | Wernicke's | RH neglect | Global |
|---|---|---|---|---|---|---|---|---|---|
| `/auth` | | | | | | | | | |
| `/onboarding` | | | | | | | | | |
| `/today` | | | | | | | | | |
| `/exercise/photo-naming` | | | | | | | | | |
| `/exercise/fix-sentence` | | | | | | | | | |
| `/exercise/minimal-pairs` | | | | | | | | | |
| `/exercise/meaning-match` | | | | | | | | | |
| `/exercise/two-clues` | | | | | | | | | |
| `/exercise/semantic-features` | | | | | | | | | |
| `/exercise/detective-mind` | | | | | | | | | |
| `/exercise/multi-step-plan` | | | | | | | | | |
| `/exercise/pattern-match` | | | | | | | | | |
| `/exercise/sentence-construction` | | | | | | | | | |
| `/exercise/phonological-awareness` | | | | | | | | | |
| `/exercise/dual-load-naming` | | | | | | | | | |
| `/exercise/category-fluency` | | | | | | | | | |
| `/exercise/synonym-generator` | | | | | | | | | |
| Session summary | | | | | | | | | |

Per-profile cells: `pass` / `risk` / `block`.

## 4. Recommendation (post-audit)

To be filled by auditor. One of:

- **A — Adaptive UI keyed to `uiProfile`** (4 variants: `simplified-fluent`, `simplified-non-fluent`, `simplified-neglect`, `minimal`; default `standard`). Clinician sets via Patient Hub Plan tab.
- **B — Single Simplified Mode toggle.** Faster, less precise.
- **C — Global replacement.** Only if >70% of routes block all four profiles.

## 5. Hard guarantees (carried from Phase 2 plan)

Phase 2C build MUST NOT touch:

- `src/hooks/use*Progression.ts`
- `src/hooks/use*Game.ts`
- `src/lib/responseValidation.ts`, mastery routing, scoring
- Speech pipeline / TTS / mic state machine
- Smart Coach turn pipeline / drill triggers
- Content banks (`src/data/*Bank.ts`)

Profile-aware variants live in **presentation components only**, branching on the `uiProfile` field — never on game state, never on role.

## 6. Open questions (decide after audit)

1. Does audit confirm 4 profiles, or collapse to 2–3?
2. Does a "caregiver-driving-the-tablet" sub-mode need to exist?
3. Is there a fatigue signal that should auto-shift profile temporarily?
