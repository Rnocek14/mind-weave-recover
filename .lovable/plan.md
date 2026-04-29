
# Are we on the right path? Honest answer.

**Yes on architecture. No on signal.** The advisor's instinct is correct in spirit but wrong in the mechanism. Here is what the code actually shows, why FixSentence didn't move, and what to fix before any more games.

---

## What's actually happening (verified in code)

### 1. The adaptation engine is sound
`useInGameAdaptation` + `AdaptiveDifficultyController` correctly:
- Maintains a rolling window (`windowSize=5` for FixSentence)
- Compares success rate to `targetSuccessRate=0.75 ± 0.10`
- Calls `onDifficultyChange` and `setActiveDifficulty` to repool trials
- Clamps to `bounds.floor`/`bounds.ceiling`

This is real, not cosmetic. PhrasePractice already proved it (1→2→3→4).

### 2. Why FixSentence stayed at L1 — three compounding causes
1. **Floor clamp.** `bounds.suggestedStart=1` and `floor=1`. Every "down" computation clamps to 1, so down-shifts are invisible.
2. **Window math kills movement.** `trialCount=5`, `windowSize=5` → exactly **one** decision point (after trial 5). The session ended before any second adjustment was possible.
3. **The signal feeding the controller is noisy.** This is the real story below.

### 3. The actual scoring bug (advisor was right, wrong reason)
In `useFixSentenceGame.scoreAnswer`:
```
isCorrect       = bestSim >= 0.80
isPartialCredit = bestSim in [0.60, 0.80)
```
`bestSim` comes from `getSemanticSimilarity` → OpenAI embeddings → cosine → **rescaled `(cos+1)/2`**.

That rescale is the problem. Raw cosine of two unrelated common English words from `text-embedding-3-small` is typically **0.15–0.40**. After `(x+1)/2` it becomes **0.57–0.70** — i.e. **nonsense words land squarely in "partial credit" territory** (≥0.60), and even reach "correct" (≥0.80) for loosely related words.

**Important nuance the advisor missed:** the adaptation controller treats `partial_credit` as **incorrect** (`recordAdaptiveTrial({ correct: result.isCorrect })`, line 214 — `isPartialCredit` alone is `correct:false`). So partial credit doesn't make the system "think the user is doing okay." It just gives the **user** misleading positive UX while silently logging failure. Both bad, but in different ways:
- Clinically: false reassurance to the patient
- Telemetrically: error_type is `partial_credit` instead of `incorrect`, polluting downstream learning-rate / phoneme / cue analytics

### 4. System-wide spread of the same bug
The `(sim+1)/2` rescale lives in **one file** (`src/lib/semanticSimilarity.ts`) and is consumed by FixSentence, DescribeGuess (`bestSimilarity >= 0.5`), and several other scorers. Fixing it once helps everywhere; not fixing it means every remaining game in the validation pass will produce the same misleading signal.

---

## So — are we on the right path?

- **Architecture:** yes. Bridge, telemetry, repooling, gates, logger — all working.
- **Signal quality:** no. We've been validating plumbing with a leaky pressure gauge.
- **Validation harness:** no. 5 trials + windowSize 5 + floor=1 makes it mathematically impossible to observe both an UP and a DOWN in one sitting. We need a deterministic harness, not more manual playthroughs.

For clinical trials, **signal correctness > more game coverage**. Fix this now.

---

## Plan (in this exact order — no game-by-game pass until step 1–3 are green)

### Step 1 — Fix the semantic similarity scale (root cause, one file)
File: `src/lib/semanticSimilarity.ts`

- Remove the `(sim + 1) / 2` rescale. Embeddings from OpenAI are normalized; raw cosine is already in `[-1, 1]` and almost always in `[0, 1]` for English text. Return `Math.max(0, cos)` directly.
- Add a **lexical guard**: if `spoken` and `target` share no normalized substring of length ≥3 AND share no aliased form, cap returned similarity at `0.45` (forces "incorrect" regardless of embedding noise).
- Add an **identity short-circuit for nonsense**: if `spoken` is not in any English-letters-only pattern of length ≥2, or matches a known filler, return `0`.
- Add a small **regression test** with fixed cases:
  - `("knife","knife") → 1.0`
  - `("blade","knife") → ≥0.75`
  - `("cutter","knife") → ∈[0.55,0.80)` (true partial)
  - `("banana","knife") → <0.45` (incorrect)
  - `("asdfgh","knife") → 0`

### Step 2 — Re-tier the FixSentence thresholds and adapt the contract
Files: `src/hooks/useFixSentenceGame.ts`, `src/components/FixSentenceGame.tsx`

- Tighten thresholds: `isCorrect >= 0.78` (unchanged-ish), `isPartialCredit ∈ [0.55, 0.78)` only when `localMatch` returned null AND there's lexical overlap with an accepted fix or alias root.
- **Critical clinical decision**: stop reporting `error_type='partial_credit'` to telemetry when `isPartialCredit && !isCorrect`. Map it to `incorrect_close` so downstream analytics treat it as a failure with a hint flag (`closeMiss: true` in `taskParameters`). Adaptation already counts it as failure — telemetry should match.
- Document this rule in `src/docs/EXERCISE_ADAPTATION_GUIDE.md`.

### Step 3 — Build a deterministic adaptation harness (replaces manual playthroughs)
New file: `src/pages/dev/AdaptationSignalHarness.tsx` (route `/dev/signal-harness`).

Already-existing pieces to reuse: `AdaptationSimDev`, `useAdaptationTrialLogger`, `useInGameAdaptation`.

The harness drives `useInGameAdaptation` directly (no UI game) for each exercise slug with three scripted trial streams:
1. **Climb script:** 8 correct → expect at least one `up` (when above floor)
2. **Fall script:** start at L4, 6 incorrect → expect at least one `down`
3. **Oscillate:** mixed 12 trials → expect one up AND one down

For each game it asserts:
- `game_level` non-null in `exercise_events`
- `adaptation_trial_logs` row count == trials submitted
- session_id alignment (no orphans)
- At least one `up` and one `down` in oscillate, given non-floor/non-ceiling start

Output: a single PASS/PARTIAL/FAIL table per game. This is the artifact you give Mercy. No more "I played it and it felt right."

### Step 4 — Validation-only `trialCount` bump
Behind a `?validation=1` query flag in each Exercise page (FixSentence, DescribeGuess, SentenceConstruction, ThoughtContinuation, SynonymGenerator, PhrasePractice), bump `trialCount` from 5 → 10. Production users still get 5. This makes manual end-to-end runs capable of showing both directions.

### Step 5 — Re-run FixSentence, then proceed game by game
Only after steps 1–4 are merged:
1. Run the harness — must show PASS for FixSentence on all three scripts.
2. Run a manual `?validation=1` session — confirm console logs show at least one UP and one DOWN.
3. Move to DescribeGuess (apply same threshold review since it shares `getSemanticSimilarity`).
4. Then SentenceConstruction, ThoughtContinuation, SynonymGenerator (PhrasePractice already validated).

Add typing fallbacks per game in this same loop (already planned), but only after the signal is verified for that game.

---

## What I am explicitly **not** doing (and why)

- **Not** writing a new "robust scoring model for stroke rehab" from scratch right now. Embeddings + lexical guard + tightened thresholds is the minimum viable correct signal. A custom phoneme/semantic-feature model is a Phase-2 research deliverable, not a blocker for clinical trial validation of the adaptive engine.
- **Not** changing `windowSize` globally. Five is clinically defensible; the harness exposes the true behavior without us hand-tuning the engine to hide a signal bug.
- **Not** re-architecting telemetry. The bridge is proven. The fix is in the scorer, not the bus.

---

## Files that will change in implementation

- `src/lib/semanticSimilarity.ts` — remove rescale, add lexical guard + nonsense short-circuit
- `src/lib/__tests__/semanticSimilarity.test.ts` — new regression tests
- `src/hooks/useFixSentenceGame.ts` — tighten thresholds, require lexical overlap for partial
- `src/components/FixSentenceGame.tsx` — change reported `error_type` for close-miss
- `src/pages/FixSentenceExercise.tsx` (and 4 sibling Exercise pages) — `?validation=1` trialCount override
- `src/pages/dev/AdaptationSignalHarness.tsx` — new deterministic harness page
- `src/App.tsx` — register `/dev/signal-harness` route
- `src/docs/EXERCISE_ADAPTATION_GUIDE.md` — document the close-miss rule

---

## Bottom line for clinical trials

You were right to stop and ask. Continuing the 6-game pass on the current scorer would produce data that looks fine and is wrong. After step 1–3 land, the system will be both technically and behaviorally adaptive, and the harness gives you a reproducible artifact instead of a feeling.
