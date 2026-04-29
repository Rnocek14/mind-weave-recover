## Phase 4 — Live Adaptation Validation

The bridge code (Step 1) and real-repool fixes (Steps 3–4) are correctly wired in source. But the DB shows **zero rows with `game_level` populated** in the last 14 days — because no session has been played since deployment. Validation now has two jobs:

1. Prove the telemetry pipe is alive end-to-end (`game_level` non-null in `exercise_events` and `adaptation_trial_logs.difficulty_change_*` shifts within a single session).
2. Prove adaptation is *perceptually* real — upcoming content actually changes after a level shift, not just the badge.

---

### What I'll do (after approval)

**Step A — Automated live runs in the preview browser**

For each of the 6 target games, drive a session with the browser tool:

- FixSentence
- DescribeGuess
- SentenceConstruction
- PhrasePractice
- SynonymGenerator
- ThoughtContinuation

Per game: 7+ trials, alternating high-accuracy → low-accuracy → hesitation pattern to force at least one UP and one DOWN shift. Capture browser console logs after each game (looking for the `[GameName] L{from} → L{to}` lines) and a screenshot at the moment of the level shift to confirm the badge updates.

**Step B — DB verification queries (per session, per game)**

Run after each game:

```sql
-- Telemetry pipe alive?
SELECT round, task_parameters->>'game_level' AS game_level,
       outputs->>'game_level' AS out_level,
       task_parameters->>'game_level_source' AS src
FROM exercise_events
WHERE session_id = :sid AND exercise_slug = :slug
ORDER BY round;

-- Adaptation actually firing?
SELECT trial_index, difficulty,
       difficulty_change_from, difficulty_change_to,
       difficulty_change_direction, difficulty_change_reason
FROM adaptation_trial_logs
WHERE session_id = :sid AND exercise_slug = :slug
ORDER BY trial_index;
```

Pass criteria per game:
- `game_level` non-null on every row
- ≥1 row with `difficulty_change_direction` = `up` or `down`
- distinct `task_parameters->>'game_level'` values ≥ 2

**Step C — Content-disjointness probe**

For FixSentence, DescribeGuess, SentenceConstruction, PhrasePractice, SynonymGenerator: extract the trial prompts/items shown before the level shift vs after, and confirm the *post-shift* set is not just a continuation of the pre-shift pool. This is what catches "level changed but content feels the same".

For ThoughtContinuation (discourse): confirm prompt complexity tier changes (sentence length / abstractness band).

**Step D — Per-game report**

Single table with columns: `game | trials | levels seen | shifts | game_level rows | content repooled? | console log present? | verdict`.

Verdict is one of:
- `PASS` — telemetry + repool both confirmed
- `PARTIAL` — telemetry OK, repool weak (e.g. PhrasePractice "next-advance only")
- `FAIL` — telemetry missing or content unchanged → file a follow-up fix

**Step E — Targeted fixes only**

I will only edit code if Step D produces a `FAIL` or a `PARTIAL` that's a quick fix (e.g. immediate-repool for PhrasePractice). Anything larger I'll surface as a new plan, not silently patch.

---

### What I will NOT do in this loop

- No content-bank expansion (that's the next bottleneck per the user, but a separate effort).
- No new adaptive games wired (Step 2 LevelBadge rollout stays separate).
- No schema changes.

### Risks / honest caveats

- **Browser auth**: if the preview requires login I will stop and ask, not fill credentials.
- **Speech-driven games** (SentenceConstruction, ThoughtContinuation, PhrasePractice): browser automation can't speak. I'll use the typing fallback / "I Said It!" manual override for those, and call out clearly that voice-path adaptation was inferred, not driven.
- **Synthetic perf pattern**: forced patterns may not match real clinical signal exactly; verdict will explicitly note "behavior under synthetic input" vs "behavior in real session".
- If a game has no shift after 10 trials despite a forced low-accuracy run, that itself is a finding (gate too tight or signal not flowing).

### Deliverable

A single report message with the per-game table, the SQL evidence, and a prioritized fix list. No silent edits.
