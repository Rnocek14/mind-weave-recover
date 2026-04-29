# Game-level adaptation fix plan

## Audit result

Sessions are adaptive, but the lesson games are not yet uniformly adaptive at the game level.

The real blockers are now clear:

1. `exercise_events.task_parameters.game_level` and `outputs.game_level` are still null on every recent row.
2. Several games adapt internally but do not expose the level to the shared telemetry writer.
3. Two games have real tiered banks but lock their initial trial pool, so level changes do not actually repool content:
   - `FixSentenceGame`
   - `DescribeGuessGame`
4. Some session games use older or separate adaptation paths:
   - `PhrasePracticeGame` uses `useInGameAdaptation`, but its content repool and LevelBadge/telemetry contract need standardization.
   - `SynonymGeneratorGame` uses the older `useAdaptiveDifficulty` path.
   - `ThoughtContinuationGame` uses discourse adaptation and writes `adaptation_trial_logs`, but not the unified `exercise_events.game_level` path.
   - `SentenceConstructionGame` has leveled content but no in-session adaptation controller.
5. Lesson session routing still has one risky legacy alias: `phrase-practice` is routed through `/exercise/word-practice`, while `/exercise/phrase-practice` falls through the generic page unless normalized.

Important correction from the previous audit: `FixSentenceBank` and `DescribeGuessBank` are already tier-tagged. The issue is not missing tier labels; the issue is that their hooks initialize `trials` once and ignore later difficulty changes.

## Goal

Make every lesson-session game fall into one of two explicit categories:

```text
Adaptive clinical game
  - has a 1-10 GameLevel
  - changes content/cue/time/complexity when level changes
  - logs game_level to exercise_events
  - logs adaptation_trial_logs where applicable

Assessment / capability game
  - intentionally does not adapt mid-assessment
  - still logs a stable game_level or assessment_level for proof
  - does not show misleading adaptive UI
```

## Step 1: Create one canonical runtime level bridge

Add a small shared level bridge used by all game adaptation hooks:

- `useInGameAdaptation` registers `{ sessionId, exerciseSlug, currentLevel, currentDifficulty }`.
- `useAdaptiveDifficulty` also registers a canonical level for legacy games.
- `useDiscourseAdaptation` exposes/registers a canonical 1-10 level for discourse games.
- `useExerciseTelemetry.logTrial` reads that registered level automatically before insert.

This fixes the silent telemetry hole globally instead of patching every page by hand.

Expected result:

- Every adaptive game writes:
  - `task_parameters.game_level`
  - `outputs.game_level`
  - `outputs.difficulty_level`
- If a page already passes `game_level`, the explicit value wins.
- If no adaptive controller is active, telemetry writes `game_level: null` only for truly non-adaptive/assessment cases.

## Step 2: Normalize the LevelBadge contract

Create one rule:

- Show `LevelBadge` only when it reflects real current behavior.
- Do not show it for games whose content or scaffold level cannot change.

Roll LevelBadge into the remaining adaptive lesson games after Step 1 is working:

- CategoryFluency
- MeaningMatch
- MinimalPairs
- Phonological
- SemanticFeature
- NarrativeRetell
- DetectiveMind
- PhotoNaming
- TwoClues
- FixSentence
- DescribeGuess
- PhrasePractice
- SentenceConstruction
- ThoughtContinuation
- SynonymGenerator

Keep assessment-style games visually distinct:

- ReachTap / LeftSideHunt: may show motor target level, not “adaptive language level.”
- PatternMatch: assessment/training level only; no misleading adaptive badge unless it is truly wired.

## Step 3: Fix the fake-adaptive games

### FixSentenceGame

Update `useFixSentenceGame` so difficulty changes actually repool upcoming trials.

Current issue:

```text
initialTrials = getFixSentenceTrials(...difficulty)
const [trials] = useState(initialTrials)
```

That means new difficulty props do not change the pool.

Fix:

- Add `setActiveDifficulty(newDifficulty)` to `useFixSentenceGame`.
- When the adaptive controller changes level, remap 1-10 level to tier 1-3.
- Rebuild only future trials, preserving completed trials/results.
- Avoid repeating current or completed trial IDs.
- Include `game_level` and `content_tier` in the trial result.

### DescribeGuessGame

Same pattern:

- Add `setActiveDifficulty(newDifficulty)` to `useDescribeGuessGame`.
- Rebuild future trials from `DESCRIBE_GUESS_BANK` by tier.
- Preserve completed results and current trial state.
- Avoid repeated targets.
- Include `game_level` and `content_tier` in the trial result.

## Step 4: Bring the remaining session games onto the same adaptive contract

### SentenceConstructionGame

It already has leveled content. Add real in-session adaptation:

- Wire `useInGameAdaptation` inside the game or page-level wrapper.
- Use `currentLevel` / tier mapping to call `nextTrial(newLevel)`.
- Record each trial outcome with `recordTrial`.
- Include `game_level`, `content_tier`, grammar focus, and trial source in telemetry.
- Add LevelBadge only after the repool path is confirmed.

### SynonymGeneratorGame

Move from older `useAdaptiveDifficulty` semantics to the canonical level contract, or register its older controller into the level bridge.

- Keep its existing timer scaling and prompt tier logic.
- Ensure each round’s prompt comes from the current adaptive level.
- Add `game_level` to telemetry through the bridge.
- Add LevelBadge once telemetry is clean.

### ThoughtContinuationGame

Do not force it into the same “correct/incorrect” model. It should remain discourse-adaptive.

Fix the proof layer:

- Map discourse level 1-5 to GameLevel 1-10.
- Register the level in the shared bridge.
- Add page/component `exercise_events` logging for each completed turn.
- Keep `adaptation_trial_logs` aligned with the same level.
- Show LevelBadge as “conversation support level,” not task difficulty.

### PhrasePracticeGame

It already uses `useInGameAdaptation`, but needs cleanup:

- Register its current level through the bridge.
- Replace the old inline “Level X” badge with `LevelBadge`.
- Ensure future phrase selection uses the updated adaptive level after every shift.
- Include `game_level` in parent `logTrial` calls automatically.

## Step 5: Fix route/session launch inconsistencies

Make lesson routing and standalone routing agree:

- Normalize `phrase-practice` and `word-practice` to one canonical route behavior.
- Ensure `/exercise/phrase-practice` does not fall into the generic fallback UI.
- Keep telemetry canonical as `phrase_practice`.
- Recheck route aliases for underscore/hyphen pairs before validation.

## Step 6: Validation pass

After implementation, run validation in this order:

1. Static scan:
   - No adaptive lesson game missing `recordTrial` or equivalent discourse `recordTurn`.
   - No LevelBadge on games without real level-driven behavior.
   - No `logTrial` paths that can write an adaptive game without `game_level`.

2. Database check after fresh trial runs:
   - `exercise_events.task_parameters.game_level` populated for adaptive games.
   - `exercise_events.outputs.game_level` populated for adaptive games.
   - `adaptation_trial_logs.difficulty` aligns with `exercise_events.game_level` for the same session/game.
   - Slugs remain canonical underscore format.

3. Real session smoke test through representative games:
   - FixSentence
   - DescribeGuess
   - SentenceConstruction
   - ThoughtContinuation
   - PhrasePractice
   - SynonymGenerator
   - One already-working EF game such as MultiStepPlanning or AbstractCompare

## What I will not do in this pass

- No new tables.
- No new dashboards.
- No Layer 2 deficit-targeted stimulus selection.
- No broad content-bank expansion yet.
- No clinical session-planning rewrite beyond route/alias fixes needed for session games to launch correctly.

## Success definition

This pass is done only when:

- Every lesson-session game either adapts honestly or is explicitly marked as non-adaptive assessment/training.
- No adaptive game shows a level badge unless level changes affect real behavior.
- Fresh `exercise_events` rows have valid 1-10 `game_level` values.
- Fresh `adaptation_trial_logs` and `exercise_events` agree on the current level.
- FixSentence and DescribeGuess no longer “look adaptive” while serving the same static content pool.