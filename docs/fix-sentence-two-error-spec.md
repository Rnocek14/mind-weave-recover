# Fix Sentence — Two-Error Repair (L5) Implementation Spec

**Status:** content + selector staged; game loop NOT implemented.
**Gate:** `TWO_ERROR_GAME_READY` in `src/lib/progression/fixSentenceContentSelector.ts`
— flip it ONLY in the same change that implements §3 below.

## 1. What already exists

- `FIX_SENTENCE_TWO_ERROR_BANK` (`src/data/fixSentenceBank.ts`): 8 trials,
  each with a primary error (top-level fields) and a `secondError` block.
  Deliberately a **separate bank** so no single-error selection path can
  serve them. Integrity pinned by
  `src/lib/__tests__/twoErrorBankIntegrity.test.ts` (computed word indices,
  distinct errors, minimum pool, leak check, honest-skip check).
- The L5 selector branch in `fixSentenceContentSelector.ts` serves the
  cohort when the gate flips; until then it skips honestly with the same
  fallback contract L6–L8 use.

## 2. Clinical intent (from `fixSentenceLevels.ts` L5)

Two independent errors per sentence; the patient must detect and repair
BOTH without being told where they are. Target support `open_response`;
accuracy bar 0.75 over ≥5 on-target attempts; trialWeight 1.25.
Trial `correct` = both errors repaired. One repaired = partial credit
(maps to `isPartialCredit`, not `isCorrect`).

## 3. Game-loop changes required (`useFixSentenceGame.ts` + `FixSentenceGame.tsx`)

1. **Phase state.** Add `repairPhase: 1 | 2` to the hook for two-error
   trials (`trial.secondError != null`). Phase resets to 1 in `nextTrial`.
2. **Order-agnostic matching.** In phase 1, `scoreAnswer` matches the
   spoken fix against the UNION of error-1 and error-2 accepted fixes
   (local match first, then semantic fallback per current thresholds).
   Whichever error the match belongs to is marked repaired; the OTHER
   becomes the sole phase-2 target. Ambiguous fixes (a word accepted by
   both errors, e.g. `knife` in `fs2_3`) credit the error whose accepted
   list ranks it first, then remove it from the phase-2 target set.
3. **Phase-2 prompt.** After a phase-1 success the UI says
   "Good — there's one more mistake in this sentence." and re-listens.
   No highlight at L5 (detection is the skill); the existing hint ladder
   may reveal the remaining error's sentence region on request, scored as
   `semantic_cue` support.
4. **Result aggregation.** Emit ONE `FixSentenceTrialResult` per sentence:
   `isCorrect` = both repaired, `isPartialCredit` = exactly one repaired,
   `reactionTimeMs` = total across phases, plus new optional fields
   `phase1Fix`/`phase2Fix` for telemetry. `submitTrial` stays once-per-
   sentence so progression/mastery weighting is unchanged.
5. **Timeout/give-up.** A phase-2 timeout still submits the aggregate
   (partial credit). Never leave a sentence half-submitted.
6. **Tests.** Extend `fixSentenceProgression.hookContract.test.ts` with:
   both-orders repair → correct; one repair + timeout → partial; ambiguous
   fix consumes only one error. Flip the gate in the same commit — the
   existing integrity test's final case then asserts the L5 pool serves.

## 4. Explicitly out of scope

L6 (`mixed_morphology`) needs inflection tags + a morpheme-aware scorer;
L7 (`embedded_clauses`) needs syntactic tags; L8 needs an open-ended
judge. Each is its own spec; none is unblocked by this work.
