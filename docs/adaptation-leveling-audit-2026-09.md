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
| Phonological Awareness | engine levels 7 and above matched nothing in a 1–5 bank, so a promoted patient got an empty screen | levels above the bank's top map to it; 1–5 are untouched |
| Category Fluency | the bridge emitted 1–3 into a 1–5 game, so L5–L8 were all identical | bridge speaks the game's real scale, one step at a time |
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

### Defects found and fixed after the first pass

**Minimal Pairs recorded only the patient's mistakes.** `useSpeechRecognition`
returns a fresh object every render, so a `[speech]` dependency gave the
mic-teardown callback a new identity every render, and the per-trial reset effect
keyed on it fired continuously — closing the say-it microphone within a frame of
it opening and resetting the step to idle. A correct answer is held back until
that step resolves, so correct answers were never reported at all. Wrong answers
were, because they do not wait. A flawless session therefore persisted nothing
(the flush short-circuits at zero buffered trials) and a mixed session was booked
as 0% accurate, which pins `supportBaseline` at its cap and makes promotion out of
any Minimal Pairs level arithmetically impossible — while the in-session engine,
which never waited on the echo, kept moving the badge. The fix holds the reporter
in a ref, reports on every exit from the feedback screen, and closes the
microphone on the way out — including on the last trial, where the final
`nextTrial()` sets `isComplete` without touching `trialIndex`, so nothing else
would have. Without that last part the fix would have left the mic live on the
completion screen. The regression test installs a fake Web Speech API on purpose:
without one the echo short-circuits and reporting appears to work, which is
exactly why 127 green test files never caught it.

**The mastery gate was a practice-cadence gate.** `computeMastery` counted
distinct sessions inside the same 14-day window it uses for accuracy, so
"distributed practice" was really measuring frequency. A patient working a skill
every ten days banked plenty of trials but only two sessions per fortnight, which
pinned confidence at "low"; the gate reads low-with-volume as "stuck low" and
returns `block`, and a blocked verdict stops level-up outright. Progress sat at
100% forever with no on-screen explanation, and a patient who had already earned
"medium" lost it by easing off. Session count and day span now read a 90-day
retention window while accuracy, cue independence, the EWMA score and trial
volume stay on recency — so the change can only move a verdict from `block`
toward `pass`, never the reverse, which is proved over 180 cadence × session-size
combinations. Massed practice (one long sitting, however many trials) still
lands at "low", which is the distinction the session floor exists to draw, and a
three-trial block practised monthly still returns `skip` rather than a block no
amount of correct work could clear. The flush fetches the retention window
newest-first under an explicit cap, because an ascending query that hits
PostgREST's row ceiling drops the *newest* rows — every row the recency window is
made of. The write set stays scoped to skills practised in the last fortnight:
without that, the wider read would recompute skills the patient has not touched,
find an empty recency window, and blank their accuracy and cue-independence to
null. The model version is bumped so rows either side of the change are not
trended together.

**Three defects the first fixes introduced, caught by review.** A verified
three-lens review of the shipped diff raised fifteen findings; nine were
distinct, and these are the ones that mattered.

*Correct Minimal Pairs answers were timed against the say-it step.* Reporting a
correct trial is deliberately held until the optional echo resolves, and the
reaction time was recomputed at report time — so a patient who answered in 600 ms
and then sat silently through the window was recorded at 12,600 ms, while an
incorrect answer at the same true latency reported 600 ms. Correct answers looked
slower than wrong ones in the clinical record, and latency is what the sessions
view and the cohort analytics average. The latency is now stamped when the answer
is given; the echo step is exposure, not evaluation, and is not timed.

*Photo Naming could report one trial's support level against another trial's
answer.* Two telemetry calls run after `await`ing background analysis and read
`resolvedSupportRef` live, while every sibling value in the same payload is
snapshotted before the await. If the patient advanced first, the next trial had
already overwritten the ref. The support level is now captured with the rest.

*The retention window could manufacture distributed practice.* Two incidental
one-trial visits three months ago plus one long sitting today read as three
separate occasions and cleared a gate that a single massed sitting must not
clear. An occasion outside the recency window now has to carry at least three
trials; sessions inside recency still count regardless of size, so nothing the
old 14-day rule counted has been taken away. Two related tightenings landed with
it: the whole flush now works from one clock, so a trial on the 14-day boundary
cannot be inside the window for the write-set filter and outside it for the
scorer; and unattributed rows (written on purpose when the active profile has not
resolved) stay bounded to the recency window rather than pooling across 90 days
on a login that holds several patient profiles.

*And the model version was made load-bearing.* The gate is read at the start of a
session's flush and the mastery row is rewritten at the end, so the row the gate
sees always predates the running model. A row tagged with a superseded version
now reads as no signal — the verdict degrades to `skip`, promotion proceeds on
accuracy and evidence — until the next flush rewrites it. Without that, the first
session after this change would still have judged the cadence-trapped patient by
the maths that trapped them.

**A wrong choice tile was scored correct.** Fix Sentence builds its L1/L2 tiles by
excluding anything in the accepted-fix list, but the game grades through
`matchSpokenFix`, which also honours ±s plural tolerance. "crayon" cleared the
list and still matched the fix "crayons", so a patient tapping it was told they
were right — on the two most scaffolded rungs, with the false credit flowing
into ladder evidence. The builder now asks the scorer itself, so the two cannot
drift again. The existing tile test passed on the broken code because it used the
fix list as its oracle; the new one uses the scorer, across all three banks.

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

1. **Photo Naming serves the same words at four of its seven level-ups, and the
   selector written to fix that cannot safely be switched on.** Measured on the
   real bank: L1→L2, L3→L4, L4→L5 and L7→L8 hand the patient a byte-identical
   word list. The clinical content selector exists for exactly this — high
   frequency at L4, mid frequency at L5, category spread at L6, phrase carriers
   at L7 — and is unit-tested, but nothing in the running app reaches it:
   `usePhotoNamingGame` consults it only when the caller supplies no
   `customTrials`, and the exercise page always supplies them.

   Wiring it in was tried and reverted, because measurement showed it would trade
   a gap for a harm. Mean content tier per clinical level today runs
   1.00, 1.00, 2.00, 2.00, 2.00, 2.32, 3.00, 3.00 — flat in places, but never
   backwards. Through the selector it becomes
   1.00, 1.00, 2.00, **1.06**, 2.02, **1.66**, 1.88, 3.00: promotion from L3 to L4
   would make the words markedly *easier*, and L6 easier than L5. The cause is
   that word frequency is orthogonal to the bank's difficulty tier, and L7's
   carrier-phrase mode — the thing meant to supply L7's difficulty — sets a
   `carrierPhrase` field that no component renders. Intersecting the two axes
   restores monotonicity but collapses L4 to three usable words.

   So this needs the two difficulty axes reconciled (or the bank enriched so the
   frequency bands span the tiers), and the carrier phrase actually shown, before
   the selector can be reached. L8 additionally trains on `PROBE_WORDS`, tagged
   `isAdvancedReviewTrial` for segregation by a flag nothing outside the
   selector's own tests reads — enabling it would feed the reserved
   generalization probes into mastery as ordinary trials.
2. **Hard regression is not implemented — and is deliberately still not.** The
   spec describes a level drop after two consecutive struggle sessions; only the
   counters exist. Soft regression does work, and now demonstrably: all thirteen
   pages read `supportBaseline` and lower the engine floor a step at 2, and a
   non-struggle session decays it again. Two things argue against adding the
   level drop in this pass. The thresholds are a clinical decision the spec does
   not supply ("the level's struggle threshold" names no number). And measured on
   Photo Naming, four of the seven possible demotions would change nothing the
   patient sees — L4 and L5 mapped to the same engine band, so the demotion would
   move the clinical record, forfeit up to 100 progress points and flip the
   care-planning signal without altering the therapy. The content half of that is
   now fixed (see below), which makes hard regression *more* tractable later, not
   less; the threshold question still needs a clinician.
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
7. **Lesson-only patients can still stall.** The raised defaults apply to
   standalone sessions. A generated lesson block can carry a shorter
   `trialLimit`, and a patient who only ever practises through lessons may
   still not reach a level's evidence bar. Raising the presets is a lesson-design
   decision.
8. **Minimal Pairs state was built from mistake-only data.** Until the reporting
   fix above, only wrong answers reached the ladder, so every stored
   minimal-pairs row records a patient who never got anything right:
   `supportBaseline` pinned at its cap, `consecutiveStruggleSessions` high, level
   at or near 1. The fix corrects the flow but not the history — a patient
   discriminating at 90% restarts from a scaffolded Level 1, and the lesson
   planner has been boosting what is actually their strongest exercise. This
   belongs with item 9: a one-time pass that resets `support_baseline` and
   `consecutive_struggle_sessions` for minimal-pairs rows last written before the
   fix.
9. **Two games carry levels earned under rules that have since been
   corrected.** Two Clues levels above 3 were only reachable under the inverted
   support mapping, and Multi-Step Plan levels were earned under a much laxer
   correctness bar. Both now start from a floor derived from those levels. A
   one-time recalibration of the stored rows would be cleaner than letting the
   old numbers set the content floor.

## Review of the change set

The diff was reviewed from three independent lenses before landing: regression
risk, clinical safety, and React/runtime semantics. Two returned "do not ship"
on a first pass. Everything they raised was either fixed or verified false:

- **Kids Mode was silently switched off in Two Clues.** Supplying a difficulty
  had been treated as proof of a clinician override, so passing the patient's
  own clinical floor disabled the pediatric content filter — a child at clinical
  Level 7 would have been served the adult abstract pool. The filter now keys
  only on an explicit clinician category. This was a regression introduced by
  this work.
- **Wiring Photo Naming's clinical content selector would have inverted the
  ladder.** It was implemented, measured, and reverted in the same pass: the
  selector's frequency bands are orthogonal to the bank's difficulty tiers, so
  promotion from Level 3 to Level 4 would have handed the patient *easier* words
  (mean tier 2.00 → 1.06), and Level 6 easier than Level 5. See open item 1 for
  the full measurement and what it would take to enable. This was a regression
  introduced by this work and caught before it shipped.
- **A non-finite starting level would have crashed the exercise.** Because
  `NaN !== NaN`, the new render-phase re-seed would queue a state update on every
  render and React would abort with "too many re-renders". The seed is now
  finite-checked and bounds-clamped in both hooks, and no longer reads the ref it
  writes, so a replayed render (StrictMode, a discarded concurrent render) cannot
  leave state behind.
- **The Category Fluency remap was too aggressive twice over.** It widened the
  clamp on the session-adaptation input, which could have put a brand-new patient
  on the abstract bank at 20 seconds; and its top floors interacted with soft
  regression so that a struggling patient's scaffolded session came out harder
  than their unscaffolded session had been. The session input keeps its original
  ceiling, and the floors stop one step lower. Difficulty 5 is still reachable,
  but only by in-session escalation, which is evidence-driven.
- **The phonological remap softened content that already worked.** The first
  version moved several currently-reachable levels down by up to two bands. It
  now maps levels 1 to 5 to themselves and only fills the empty range above the
  bank's top.
- **The mastery flush would have dropped unattributed rows.** Trials are
  deliberately written with no profile when the active profile has not resolved
  yet. The query keeps the profile scoping but still counts this user's own
  unattributed rows.
- **The manual "too hard" control eased by two levels.** It now eases by one, and
  clears the rolling window so the miss recorded alongside it cannot immediately
  trigger a second drop.
- **The Photo Naming promotion scoping removed the one independence check that
  matters.** Level 3 to 4 is where the ladder stops scaffolding, so the
  cue-independence floor is still enforced on that crossing.
- **The session-length contract test did not enforce what its comment claimed.**
  It hard-coded the numbers; it now reads the shipped defaults from the pages, and
  fails if one is lowered.
- **Refuted:** the claim that tightening the plan-success rule made some items
  unpassable. Measured across all 60 planning items, a perfect recitation clears
  the bar on every one.
