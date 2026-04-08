

# Fix Transition Duration for Guided/Full Modes

## The Problem

Encouragement transitions last ~1.2–1.5 seconds. That's fine for **Games Only** (just momentum), but in **Guided** and **Full Coaching**, these transitions now carry micro-guidance text and coaching bridges that users can't read in time. The content is there but functionally invisible.

## Why It Matters

In Guided/Full modes, the transition is doing real work — it shows:
- Exercise micro-guidance ("Name as many as you can")
- Coaching bridge text ("That builds on what we just practiced")
- Adaptation messages

At 1.2–1.5s, an aphasia user cannot read any of this. The guidance exists but doesn't land.

**Games Only** should stay fast — no guidance content, pure momentum.

## The Fix

Make transition duration **coaching-mode-aware** in `ExerciseTransitionOverlay.tsx`:

- **Games Only (`off`)**: Keep current timing (~1.5s encouragement, ~5s micro-pause) — unchanged
- **Guided (`light`)**: Increase encouragement to ~3.5s when micro-guidance or coaching bridge is present
- **Full (`full`)**: Same ~3.5s, with room for slightly longer if coaching bridge is verbose

The logic change is small — in the duration calculation (line 44), check `mode` and whether guidance content exists. If mode is not `off` and there's guidance text to show, use a longer base duration (~3.5s instead of 1.5s).

## Files to Modify

1. **`src/components/ExerciseTransitionOverlay.tsx`** — Adjust `defaultDuration` calculation: if `mode !== 'off'` and guidance content is present (microGuidance or coachingBridge), use ~3.5s base for encouragement type instead of 1.5s.

That's it — one file, one conditional change.

## What This Does NOT Change

- Games Only timing stays exactly the same
- Micro-pause timing stays the same
- No new UI elements
- No new components
- Adaptive pause logic in `adaptivePauseLogic.ts` unchanged (its `durationOverride` still works)

