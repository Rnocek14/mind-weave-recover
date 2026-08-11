# Functional Command Scenes — "Say it, see it" for Adults

**Status:** IMPLEMENTED (this wave) as a PRACTICE surface — deliberately
outside the mastery/progression system. Flagged for SLP review before
launch (targets the most vulnerable users).

## 1. Why

The kids mode's speech-reactive animations ("bigger" → the tower grows)
are response-contingent feedback: speech produces an immediate, visible,
contingent consequence. The mechanism is clinically sound and age-neutral
— it restores agency and gives a zero-pressure production onramp. The
presentation is what must change for adults: real-world imagery and
physical effects (brighten, scale, fill), never cartoon rewards.

Clinical targets:
- **Core-word production** (more, less, up, down, stop, go) — the
  highest-frequency functional vocabulary.
- **Comparative morphology** (bigger, smaller, brighter, faster) — the
  same inflection family the Fix Sentence L6 tier treats; the scene logs
  whether the base form ("big") or the comparative ("bigger") was used.
- **Severe-profile onramp**: the severity gate routes severe/global
  profiles to tap-based games; this exercise joins that allowlist. Every
  command is also a large tap target, and tapping MODELS the word aloud
  via TTS before applying the effect — errorless practice.

## 2. Interaction contract

- A photographed scene (lamp, ball, bird, car, cup, candle) with 2–6
  command words. Speaking a command — or any utterance containing it,
  e.g. "make it bigger" — applies a physical effect: CSS brightness,
  scale, translate, fill level, motion speed. If several commands appear
  in one utterance, the LAST one wins (most recent intent).
- Effects step through bounded ranges. At a boundary the scene answers
  honestly ("That's as big as it goes") instead of ignoring the patient.
- Every state change is announced via `aria-live` ("The lamp is
  brighter") and spoken state is mirrored in the transcript line.
- `prefers-reduced-motion`: transitions become instant state changes —
  the change stays visible, the animation goes away.
- No scores, no streaks, no failure states. Unmatched speech gets a
  gentle "try one of the words below" hint, never an error sound.

## 3. Non-goals / guardrails

- **Not an assessment.** No mastery routing, no clinical progression, no
  adaptation logging. Telemetry is `app_events` only
  (`scene_practice_started`, `scene_command` with scene/command/form/
  inputMode/changed) so usage is analyzable without judging patients.
- No open-ended ASR grading — the vocabulary is closed per scene.
- Single short words are ASR's weakest case; the closed vocabulary plus
  containment matching plus the tap fallback bound the risk. If
  recognition is unavailable the exercise remains fully usable by tap.

## 4. Architecture

- `src/lib/scenes/sceneEngine.ts` — pure: scene definitions typed as
  bounded axes (`step`, `toggle`, `set`) + `applyCommandUtterance()`
  (normalize → token containment → last-match-wins → clamped transition,
  reports `formUsed` base vs comparative).
- `src/data/functionalSceneBank.ts` — six scenes on existing photo
  assets; integrity-tested (unique vocab per scene, axes referenced by
  commands exist, opposing pairs present).
- `src/components/FunctionalScenePlayer.tsx` — presentation + input
  (speech via the existing `useSpeechRecognition`, tap via buttons that
  TTS-model the word), reduced-motion aware.
- `src/pages/FunctionalScenesExercise.tsx` — route glue + funnel events.
- Severity gating: slug added to `SEVERE_APHASIA_FRIENDLY_EXERCISES`.

## 4b. Severe-aphasia additions (wave-15 QA walk-through)

Playing the scenes as a global-aphasia user surfaced four gaps, all now
implemented:

1. **Icons on every command button.** Global aphasia frequently includes
   alexia — text-only buttons were unusable for the exact cohort the
   severity gate routes here. Every command now carries a pictographic
   icon (sun/moon, zoom in/out, arrows, play/stop, plus/minus, flame/wind);
   the word stays the accessible name.
2. **Spoken scene prompt on entry** — non-readers hear what to do.
3. **"Show me" demonstration button** — speaks the first command and
   performs it, tagged `inputMode: 'demo'` in telemetry so demonstrations
   never read as patient productions.
4. **Spoken confirmation of SPEECH successes** ("The lamp is brighter")
   — comprehension support; tap keeps word-modeling only so the two
   utterances don't cut each other off.

Also from the browser pass: scene switches remount the photo (no
cross-scene transform morphing) and the cup's fill overlay is bounded to
the photo, not the card.

## 5. SLP review questions

1. Are the six scene vocabularies the right starter set for core-word work?
2. Should tap-modeling speak the word BEFORE the effect (current) or after?
3. Is "That's as big as it goes" the right boundary phrasing for
   comprehension-impaired users, or should the boundary simply pulse?
4. Which two scenes should the Today flow suggest for severe profiles?
