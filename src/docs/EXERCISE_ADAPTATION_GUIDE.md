# Exercise Adaptation Guide

How each exercise adapts in real time. Read this before adding a new exercise or changing the difficulty system.

## The two-layer model

1. **Generic engine** — `useInGameAdaptation` (or `useAdaptiveDifficulty`)
   Feeds trial results into a 5-trial rolling window. If success rate >90% → level up. <70% → level down. 4 errors in a row → emergency 2-step step-down.

2. **Game-specific consumer** — each game must take the level change and *swap content*. If a game logs trials but never swaps content, the level number changes silently and nothing happens. **This is the most common bug.**

The contract: when the engine fires `onDifficultyChange(newLevel, reason, dir)`, the game is responsible for either calling its hook's `setActiveTier` / `setActiveDifficulty` (which swaps only the upcoming queue, never the past) or otherwise re-deriving its content.

> **Anti-pattern**: Passing `currentDifficulty` directly into a hook that has it in a `useEffect` dep array. That resets `currentTrial`, `score`, and `completed` mid-round. Fixed in `usePhonoGame` and `useSemanticFeatureGame` (Apr 2026).

## Per-exercise scorecard

| Exercise | Adapts mid-session | What "harder" means | Visibility |
|---|---|---|---|
| Sentence Construction | Yes | Adds words, then compound sentences | Shown |
| Narrative Retell (`/today`) | Yes | T1: 3-sent → T2: 4-5 sent → T3: 5-6 sent + inference. `setActiveTier` reshuffles upcoming queue | AdaptationBadge |
| Detective Mind | Yes | Story length grows, literal → inferential → predictive questions, 3 → 4 options | AdaptationBadge |
| Multi-Step Planning | Yes | More steps, less obvious order | AdaptationBadge |
| Abstract Compare | Yes | Concrete pairs (Dog/Cat) → moderate (Brain/Computer) → abstract (River/Time) | AdaptationBadge |
| Dual-Load Naming | Yes | More cognitive load per trial | AdaptationBadge |
| Meaning Match | Yes | Tier-based item swap via `setActiveTier` | AdaptationBadge |
| Pattern Match | Yes | Pattern size + option count + display time scale | Lv badge |
| Minimal Pairs | Yes | Maximally distinct → single-feature → subtle contrasts | AdaptationBadge |
| Phonological Awareness | **Yes (fixed)** | Trial bank refiltered by `getMixedTrials(level)`; upcoming queue swapped | Difficulty change banner |
| Semantic Features | **Yes (fixed)** | Trial bank + feature options regenerate at new level on upcoming queue | Lv badge |
| Synonym Generator | Partial | Timer + success threshold + word list rotate by level | Difficulty shift cue |
| Category Fluency | Partial | Timer scales; categories rotate by level | Difficulty shift cue |
| Two Clues | Partial | Internal difficulty 1-3 mapped from level 1-10 | AdaptationBadge |
| Fix the Sentence | Partial | Internal difficulty 1-3 mapped from level | (none — TODO) |
| Describe & Guess | Partial | Internal difficulty 1-3 mapped from level | (none — TODO) |
| Photo Naming | Partial | Hard mode unlocks at lv 8; manual hints at lv 6. Image bank itself isn't tiered by frequency yet | Difficulty change cue |
| Story Retell Probe (Smart Coach modal) | **Yes (fixed)** | T1 (concrete, 3-sent) → T2 (causality) → T3 (inference, time jumps). One-shot probes adapt across sessions via `lastStoryRetellTier` in profile prefs, plus in-place "Try a harder story" CTA | Level chip + CTA |
| Conversation Coach / Partner | N/A | Adapted by Smart Coach turn engine (`runCoachTurn`), not the difficulty controller | Maya cues |
| Thought Continuation | No | Open-ended discourse, no level concept | Acceptable |

## Standard pattern for new exercises

```tsx
const game = useMyGame(totalTrials, config.startDifficulty || 1, customTrials);

const { currentDifficulty, recordTrial /* or updateTrial */ } = useInGameAdaptation({
  initialDifficulty: config.startDifficulty || 1,
  bounds,
  onDifficultyChange: (newLevel, reason, dir) => {
    game.setActiveDifficulty(newLevel);   // swap upcoming queue, never reset
    signalShift(dir, reason);             // <AdaptationBadge /> visible cue
  },
});
```

Inside `useMyGame`:

- `difficultyLevel` is **only** used at mount. **Never** put it in a `useEffect` dep that resets state.
- Expose `setActiveDifficulty(newLevel)` that:
  1. computes `upcomingNeeded = trials.length - (currentTrial + 1)`
  2. fetches fresh trials for the new level
  3. replaces only the upcoming slice, keeping played + current trial intact

## Open gaps to fix later

- **Photo Naming**: tag the photo bank by syllable count + frequency so word retrieval difficulty scales (not just UI mode).
- **Fix the Sentence / Describe & Guess**: add visible AdaptationBadge so users see when difficulty shifts.
- **Telemetry**: add a per-session signal `{ level_started, level_ended, content_tier_shifts }` to `exercise_events.inputs`, then surface a "Adaptation active?" column on the Telemetry dashboard. Games where `level_started === level_ended` for >80% of sessions are suspect.
