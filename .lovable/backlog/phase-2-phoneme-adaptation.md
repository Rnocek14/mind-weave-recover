# Phase 2: Phoneme-Level Adaptation (Backlog)

**Status:** Not started — DO NOT implement until Layer 2 (perceptual content curve L1–L10) is complete and validated for at least FixSentence + DescribeGuess + PhrasePractice.

## Goal

Personalize trial selection by biasing toward word/sentence targets that contain phonemes the user struggles with. Mirrors how SLPs target articulation in clinic.

## Scope (intentionally narrow)

Only games where the user **produces a specific lexical target** that has a clean phonetic profile:

- **PhrasePractice** — production-heavy, transcript available, target phrase known
- **DescribeGuess** — single-word naming target, clean phonetic surface

Explicitly **out of scope** (sound-targeting doesn't apply meaningfully):

- FixSentence — target word is a *repair*, often multi-option
- ThoughtContinuation — open-ended discourse
- SynonymGenerator — semantic, not phonetic
- SentenceConstruction — structural, not phonetic

## Non-Negotiable Design Rule

> **Phoneme bias operates ONLY within the user's current difficulty tier. It MUST NOT pull from an easier tier to satisfy a phoneme target.**

Rationale: pulling easier content to satisfy a phoneme bias would silently drop perceived difficulty — re-introducing the exact "fake adaptation" bug Layer 2 just fixed.

Implementation: phoneme targeting is a **sort/weight** within the band-isolated pool, never a pool replacement.

## Required Substrate (must exist before building)

1. **Phoneme tagging on every trial** in scope banks (already partially present as `phonemeTargets: string[]` on FixSentence — schema is ready, but tags need audit + extension to PhrasePractice/DescribeGuess).
2. **Per-trial phoneme failure detection** from speech transcript — substitution/omission analysis comparing target word to recognized word.
3. **Per-user phoneme difficulty profile** — rolling window of failure rates per phoneme, persisted to `adaptation_trial_logs` or a new `user_phoneme_profile` table.
4. **Selector integration** — `getDescribeGuessTrials({ difficulty, focusPhonemes })` already accepts the param; needs the profile feeding it.

## Build Order (when ready)

1. Audit + complete phoneme tags on PhrasePractice + DescribeGuess banks
2. Add phoneme-failure extraction to speech scoring (PhrasePractice + DescribeGuess only)
3. Persist per-user phoneme profile (rolling 20-trial window)
4. Wire `focusPhonemes` from profile → selectors
5. Validation: distinctness audit must still pass; phoneme-targeted runs should show ≥30% increase in trials containing the focus phoneme vs baseline, with **zero** drop in average tier.

## Why we are NOT doing this now

- Layer 2 (perceptual curve L1–L10) only validated for FixSentence + DescribeGuess at 3 tiers.
- Adding a 3rd adaptation dimension before Layer 2 is fully proven would make debugging ambiguous.
- Phoneme tags need to apply to the full L1–L10 expanded bank, not the current 3-tier bank — better to tag once, after expansion.

## Trigger condition to start Phase 2

✅ FixSentence has full L1–L10 distinct content
✅ DescribeGuess has full L1–L10 distinct content
✅ PhrasePractice has full L1–L10 distinct content
✅ Distinctness audit passes for all three at every level
✅ At least one real-user session shows clean engine→content adaptation across ≥3 level shifts
