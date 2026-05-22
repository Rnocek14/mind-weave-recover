# Pass B — Stroke-Profile Archetype Walkthrough

**Purpose:** Fill the empty P4 cells in `docs/accessibility/stroke-profile-audit.md` §3.2 / §4 by driving the live app as each of the four archetypes. Read-only QA — no app code, scoring, or content changes.

## Prerequisite

Enable **Anonymous Sign-Ins** in Supabase → Authentication → Providers. Without it, `signInAnonymously()` errors, `Today.tsx:181` bounces to `/auth`, and the walkthrough cannot start.

Verify by clicking **Start Without Account** on `/auth`. You should land on `/today` with a real `auth.users` row (check the session HUD).

## Viewports

Run the full sweep at both:

- **390 × 844** (iPhone 13/14, primary patient device)
- **1366 × 768** (clinician laptop sanity check)

## Routes

Five representative routes plus session summary:

1. `/today`
2. `/exercise/fix-sentence` — reading-heavy
3. `/exercise/multi-step-plan` — open speech under load
4. `/exercise/category-fluency` — 60s open speech
5. `/exercise/minimal-pairs` — control (already `pass` across all profiles per Pass A)
6. Session summary (end of any session)

## Archetypes

For each route, walk through as each profile and record blocker / risk / pass per dimension below. See audit §2 for full archetype definitions.

| Archetype | Simulate by |
|---|---|
| Broca's (non-fluent) | Switch input mode to typing only; expect to use "I Said It!" overrides; ignore long verbal instructions |
| Wernicke's (fluent, comprehension) | Cover instruction text with a finger; rely on icons/demos only; do not re-read |
| Right-hemisphere (left neglect) | Ignore the left 25% of every screen; click only what is visually salient on the right |
| Global (severe) | Single-tap only; no reading; abandon any flow that requires ≥ 2 sequential decisions |

## Dimensions to fill (P4)

For each (route × archetype) cell:

- **Tap-target size:** any primary target < 44 × 44 CSS px? note element + measured size
- **Words-per-screen:** count visible words on the primary task surface (exclude chrome)
- **Decisions-per-screen:** count of distinct interactive choices visible without scrolling
- **Contrast on semantic tokens:** spot-check `text-muted-foreground`, disabled states, placeholder text against background (Chrome DevTools → Inspect → contrast pane)
- **Left-edge salience:** is any required control in the left 25% with no right-side cue?
- **Dead-state risk:** can this archetype reach a state with no obvious next action?

## Recording

Append a new section `## 9. Pass B results (YYYY-MM-DD)` to `docs/accessibility/stroke-profile-audit.md` with:

- One table per route, rows = 4 archetypes, columns = 6 dimensions above
- Replace `pass` / `risk` / `block` cells in §4 scorecard with confirmed values
- Update §5 recommendation if the data changes the A/B/C balance
- Update §3.2 P4 row with a one-line summary of what was measured

## Hard guarantees (carry from Phase 2A)

Pass B is observation only. Do NOT edit during the walkthrough:

- Progression hooks (`src/hooks/use*Progression.ts`, `src/hooks/use*Game.ts`)
- Scoring, mastery, validation (`responseValidation.ts`, mastery routing)
- Speech pipeline, TTS, mic state machine
- Smart Coach turn pipeline, drill triggers
- Content banks

If you spot a bug worth fixing, log it as a finding — fix it in Phase 2B with the rest.
