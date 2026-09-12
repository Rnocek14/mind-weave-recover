# Adaptation, difficulty and leveling — audit and repairs (September 2026)

## What was reviewed

Every path that decides how hard the app is for a patient, in-session and
across sessions:

- the shared in-session engine (`AdaptiveDifficultyController`,
  `useInGameAdaptation`, `useAdaptiveDifficulty`, `useDynamicTier`),
- the persistent clinical ladder (`clinicalProgression`, the 19 per-game
  `*Levels.ts` specs, the 13 `*DifficultyBridge.ts` bridges, the 13
  `use*Progression` hooks),
- how each of the 19 exercises picks its starting level and swaps content when
  the level moves,
- the unified trial pathway and session-end flush,
- the mastery confidence gate and the shadow flush,
- content banks and per-level selectors.

Findings were produced per game and per system layer, then each was checked by
an independent reproducer that wrote and ran tests against the real modules and
by an adversarial reviewer whose job was to refute it. Anything the two
disagreed on went to a third judge. Only findings that survived are acted on
below.

Baseline before any change: 116 test files, 1611 tests passing, lint clean,
typecheck clean apart from two pre-existing errors in an unrelated test file.

## What was wrong, and what changed

### The engine punished a single wrong answer

`computeFrustrationLevel` read the success rate off a partially-filled window,
so the first miss of a session read as 0% and triggered the emergency two-level
step-down. A patient at engine level 5 dropped to 3 on one wrong answer, and to
1 on the second. This contradicted the leveling contract ("Never punish a single
trial or a single session") and the adaptation guide, which reserves the
two-step drop for four errors in a row.

The rate clauses now require a full window. The consecutive-error clauses are
untouched, so four errors in a row still steps down as documented.

### The engine then over-climbed

The rolling window was never cleared when the level changed, so once four
correct answers filled it, every further correct answer stepped up again — level
5 to 10 in eight trials, each new level "earned" by a single trial. The window
is now cleared whenever the level moves, so a level is earned by evidence
gathered at that level.

### The stored clinical level often never reached the game

Pages resolve the patient's persistent level asynchronously, but the controller
kept whatever it saw on the first render. A render-level load gate cannot help,
because React runs the hook before the gate can return. Both hooks now adopt a
later starting level until the first trial is recorded — during render, not in
an effect, because React renders child components before parent effects run, so
an effect-based adoption fixed the badge and the telemetry while the patient
still played level-1 content.

Photo Naming had a second, deterministic version of this: the trial list was
chosen and frozen on the first commit, before the level was known. The selection
effect now waits for the same conditions the render gate waits for.

Related scale mismatches, each of which meant the level moved but the content
did not:

| Game | Was | Now |
|---|---|---|
| Minimal Pairs | mid-session swap passed a 1–3 tier to a function expecting a 1–10 level, so every swap served the easiest contrasts | passes the engine level |
| Multi-Step Planning | the page's 1–10 engine floor was read as a 1–3 content tier, and the controller seeded at `tier × 3` | prop is an engine level, collapsed for content selection |
| Phonological Awareness | engine levels 7 and above matched nothing in a 1–5 bank, so a promoted patient got an empty screen | engine levels collapse onto the bank |
| Category Fluency | the bridge emitted 1–3 into a 1–5 game, so the abstract categories were unreachable and L5–L8 were identical | bridge speaks the game's real scale |
| Two Clues | the game received no difficulty at all and never filtered or swapped content | receives the clinical floor and swaps the upcoming queue |
| Dual-Load Naming | the pool filter was upper-bound only, so tiers 2 and 3 were the same content | strict tier isolation |

### Ladders that could never advance

Promotion needs a level's evidence rule satisfied within one session, but
several games shipped sessions shorter than their own requirement, so the
progress bar sat at 100% forever. Dual-Load Naming shipped 2 sets against a
3-attempt rule and could never leave Level 1. Multi-Step Plan, Synonym Generator
and Category Fluency each froze at the first rung asking for 4.

Default session lengths were raised to meet the highest requirement across each
game's implemented rungs, and a contract test now fails if a rung ever asks for
more than a session provides.

### Receptive games booked every clean session as a struggle

The credit table was already inverted for comprehension and acoustic tasks,
where answering with no hint is the independent baseline. The struggle test was
not inverted with it, so a flawless hint-free session counted as struggle:
support inflation pinned at its cap, the soft-regression scaffold stayed on
permanently for the best-performing patients, and the success counter never left
zero. There is now a receptive struggle predicate, used by Meaning Match,
Detective Mind and Phonological Awareness. The expressive track is unchanged.

### Session data that never reached the ladder

- The last trial of every session was buffered into the ladder only after an
  awaited telemetry write, while completion ran the flush immediately. A
  three-round game computed its evidence on two rounds; a one-round lesson
  persisted nothing. Buffering is now synchronous.
- The flush captured the live buffer, so a trial landing during the awaited
  mastery read shifted the struggle ratio without counting toward the evidence
  it was part of. All 13 hooks now snapshot the buffer.
- A failed or timed-out progression read fell back to a default Level 1 state
  that is indistinguishable from a new patient, and the session flush wrote it
  straight over real progress — Level 4 came back as Level 1. That fallback is
  now tagged, and the ladder refuses to persist over it. A genuine "no row yet"
  still persists normally.

### Scoring and support signals that described the wrong thing

- Multi-Step Planning's order score was computed from each step's index in the
  item definition, collected in ascending order, so it was a flat 100% for any
  answer mentioning two steps — a perfectly reversed plan included. It now reads
  where each step appears in what the patient said.
- Two Clues derived its support level from how good the answer was rather than
  from the help given, so producing the intended word — the best possible
  outcome — was recorded as scaffolded while a vaguer answer counted as
  independent. Since levels 3 to 7 all target independence, the best answers
  generated no on-target evidence. Support now comes from the cue ladder the
  game actually delivered.
- Photo Naming logged a boolean where the 0–3 cue ladder belongs, which scored
  every cued-correct trial above the independence floor, so a fully
  cue-dependent patient looked independent to the mastery layer.
- Photo Naming also divided the cue-dependency score by three a second time, so
  the safety gate that holds back escalation could never fire in the one game
  with a real cue ladder.

### Other repairs

- A blocked escalation was reported to games as a level change in the "down"
  direction, so a patient who had just done well enough to earn a harder level
  was told the app had made it easier. Games now learn about a hold through the
  callback that exists for it.
- The mastery shadow flush pooled the trailing fortnight of trials by account
  rather than by patient profile, then wrote the result onto one profile. On a
  multi-profile login, one patient's performance moved another's mastery.
- The promotion quality floors describe independent naming but were applied at
  every level, including the rungs whose clinical target *is* a cue, turning a
  one-session delay into a permanent hold. They are now scoped to the levels
  they describe.
- Phrase Practice's "Too Hard" button recorded the trial twice, so one tap
  counted as two failures, and left the easing to the rolling window, so its
  promise was often not kept. It now records once and steps down.

## Verified working (a selection)

Worth stating, because much of the system is sound:

- All 13 clinical bridges are monotone, clamped, and null-safe.
- Slug namespaces are correct across the seam: hyphen for the clinical ladder,
  underscore for telemetry.
- Progress accrues monotonically, holds at 100% without evidence, promotes one
  level at a time, and is clamped to each game's implemented ceiling.
- Holding at 100% is not permanent: after a long plateau a single qualifying
  session promotes.
- Most games record each trial exactly once, and partial credit is reported as
  incorrect to the engine.
- Content selectors, where wired, are strictly tier-isolated with no blending.

## Open items — decisions rather than defects

These are real and confirmed, but each needs a clinical or product call, so
none was changed silently.

1. **The mastery gate behaves as a session-cadence gate.** Confidence reaches
   "medium" only with at least three distinct sessions inside a 14-day window,
   and the gate turns a low-confidence-with-volume row into a hard block. A
   patient practising weekly at 100% accuracy with full independence is
   therefore blocked from promotion indefinitely. Measured on the real modules:
   confidence "low", mastery score 1.00, gate "block". Note that widening the
   lookback window does **not** fix this — the session count is computed over
   the inner 14-day window, so a wider fetch raises the trial total while
   leaving confidence at "low", which makes the block *more* likely. The fix has
   to change what confidence means, or stop treating a cadence artifact as
   evidence of weakness. The rule is deliberately test-locked, so changing it is
   a policy decision.
2. **Hard regression is not implemented.** The spec describes a level drop after
   two consecutive struggle sessions; only the counters exist. Soft regression
   (support inflation) does work.
3. **In-session adaptation is inert in very short games.** With the
   single-trial punishment removed, Multi-Step Planning and Narrative Retell
   (window 4, three rounds) can no longer move within a session, and Category
   Fluency can only move on the last round. Cross-session leveling covers these
   games; if in-session movement is wanted, the window or the session length
   needs to change.
4. **Promotion cadence is slow in places.** Fix Sentence needs roughly 16
   perfect sessions to leave Level 1. Every rung is reachable, so this is
   calibration, not a defect, and it needs a clinician's target.
5. **No progression flush on early exit.** Leaving mid-session discards the
   buffered trials. The spec says abandoned trials are excluded from both
   progress and struggle, so this may be intended; it is worth confirming.
6. **Nine games have no clinical ladder.** Their start level comes from session
   adaptation only, so nothing carries across sessions.
