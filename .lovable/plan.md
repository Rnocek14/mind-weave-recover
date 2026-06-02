## Phase 2C-iii — Adaptive Maya bubble + voice-led flows

Status recap: **2C-i** (Today + session entry) and **2C-ii** (purpose banner, pause control, summary screen) are both already shipped. This is the last sub-phase.

Goal: the Maya help bubble and the voice-led narration surface read `useUiProfile()` and pick larger / calmer layout variants — exactly like the chrome already does. **Presentation-layer only.** No change to coaching logic, hint ladder, TTS, mic, auto-advance, or visibility rules.

### Scope (2 files)

**1. `src/components/coach/MayaAssistantBubble.tsx`**
- Add `useUiProfile()` + `variantClass`/`isMinimal`.
- Enlarge the bubble button tap target in simplified variants (`w-12 h-12` → `w-16 h-16`), and the help-panel action rows to bigger type / taller hit areas.
- Bump transcript + help-panel text to `text-base` in simplified variants.
- Respect the static-bubble memory rule: do **not** add new animations; in `minimal`, suppress the speaking "bounce" dots to cut visual load (the glow ring stays as the calm speaking cue).
- Read the profile inside the bubble (not the overlay) so the existing `mayaOverlayVisibility.test.tsx`, which mocks the bubble, stays green.

**2. `src/components/coach/MayaNarrationCard.tsx`** (the voice-led full-screen guidance card)
- Add `useUiProfile()` + `variantClass`.
- Scale narration text (`text-lg` → `text-xl`/`text-2xl`), continue button height, and input field height for simplified variants.
- Widen the centered column (`max-w-sm` → `max-w-md`) in simplified variants.
- In `minimal`, drop the small "Speech Therapist" sub-label and phase-label caption to reduce reading load (progress dots stay).

### Guardrails (unchanged — verified)
- No edits to `MayaSessionOverlay` logic, `CoachingModeContext`, hint ladder, `exerciseMicroGuidance`, TTS, or mic.
- No behavior keyed on role or game state — only on `profile.variant`.
- Word caps, tone, and Sync-Wait protocol untouched.

### Verification
- Build passes (auto).
- Existing `mayaOverlayVisibility` contract test still green.
- Spot-check each variant via `?uiProfile=simplified-non-fluent` and `?uiProfile=minimal` on an exercise route.

After this, all of Phase 2C is complete.
