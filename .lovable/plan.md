## Goal
Give all 6 priority games **10 real, distinct difficulty levels of content** so the adaptation engine produces visible behavioral change, not just telemetry shifts.

## Approach
For each game:
1. **Audit** the existing content bank — count actual difficulty tiers.
2. **Generate** new content with AI to fill the missing bands. I write to a `*_v2.ts` file in `src/data/` so the original is preserved for diff/review.
3. **You review** the new content in chat (I'll show level-1 vs level-5 vs level-10 samples for each game). Approve or revise.
4. **Wire** the game's hook to use `clamp(L, 1, 10)` instead of collapsing — content selected directly by canonical level.
5. **Smoke test** by playing a session with `?validation=1` (start at L4) — confirm content visibly changes when the controller moves.

## Per-game content design

What "harder" means is game-specific. I'll use these rubrics when generating:

**FixSentence** (currently 3 tiers → needs 10)
- L1–2: concrete category errors, 4–6 word sentences, household items ("She brushed her teeth with a *fork*")
- L3–4: semantic swaps, 6–8 words, common verbs
- L5–6: function errors, 8–10 words, less common nouns
- L7–8: subtle near-synonym confusions, 10–12 words, abstract domains (work, emotions)
- L9–10: idiomatic/figurative errors, 12–15 words, low-frequency vocabulary

**PhrasePractice** (currently 5 tiers, capped → needs 10)
- L1–5: existing bank
- L6–7: longer phrases (5–7 words), less frequent vocab
- L8–9: idiomatic phrases, multi-clause
- L10: complex idioms / proverbs

**DescribeGuess, SentenceConstruction, ThoughtContinuation, SynonymGenerator** — I'll audit each bank first, then propose a per-game rubric in the same loop before generating. (Some may already be deeper than I think.)

## Engine changes (small, mechanical)

After content lands:
- `useFixSentenceGame.ts` — change `Math.ceil(currentDifficulty / 3.5)` → `Math.max(1, Math.min(10, Math.round(currentDifficulty)))`. Update `FixSentenceTrial.difficulty` type from `1|2|3` to `number`.
- `PhrasePracticeGame.tsx` — remove the `Math.min(initialDifficulty, 5)` clamp.
- `SynonymGeneratorGame.tsx` — change `windowSize: 3` → `4` for consistency (no clinical reason for the outlier).
- All games using `useInGameAdaptation`: standardize `windowSize: 4` (matches the documented default).

## Validation flag
Extend `useValidationTrialCount` to also override `initialDifficulty` to L4 when `?validation=1` is present, so a single manual run can demonstrate both UP and DOWN shifts.

## Smoke-test protocol per game
1. Open `/exercise/<slug>?validation=1`
2. Force 4 successes — confirm console shows L4→L5 (or higher) AND the new trial content visibly differs from the previous.
3. Force 4 failures — confirm L5→L4→L3 AND content visibly easier.
4. Confirm DB row in `adaptation_trial_logs` shows ≥3 distinct `difficulty` values for that session.

## What I will NOT do this loop
- No new harness pages, no provenance columns, no DB migrations. Those were ceremony — they don't fix the core problem. They become real follow-ups *after* content depth is real.
- No scoring engine changes.
- No typing-fallback expansion. Typing fallback for FixSentence already exists from yesterday; the others can wait until content is fixed.

## Out of scope (deferred follow-ups)
- Clinician-reviewed content sign-off pass. I'll mark generated content with `// AI-generated, pending SLP review` so it's grep-able later.
- Per-trial decision provenance columns in `adaptation_trial_logs`.
- DB-backed end-to-end harness.

## Why this is right
Every previous plan tried to instrument or guard the engine. The engine already works — PhotoNaming and NarrativeRetell prove it daily in the DB. The thing that's broken is **the content layer doesn't have 10 levels for the engine to express**. Fix that, the rest works for free.
