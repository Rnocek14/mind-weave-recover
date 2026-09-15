/**
 * Describe & Guess auto-submit decision.
 *
 * WHY THIS IS ITS OWN FILE: the game used to decide "are they finished?" with
 * a bare `silenceMs >= baseSilenceMs * multiplier` inline in the component.
 * With the shared discourse profile that evaluates to 1080ms — and the shared
 * classifier calls any 3+ word utterance 'complete' after 800ms of quiet. So
 * a person who said "it's round and made of metal" and paused to find their
 * next thought had the turn taken at roughly one second.
 *
 * That is the wrong question for THIS game. Describe & Guess asks for three
 * separate propositions — what it looks like, where you find it, what it is
 * used for. The end of the first proposition is not the end of the answer.
 *
 * Kept OUT of src/lib/speechTimingProfiles.ts and speechStateClassifier.ts on
 * purpose: those are shared with every other game, and widening their patience
 * to suit a three-part discourse task would make single-answer games feel
 * broken. This module is imported by Describe & Guess alone.
 *
 * Pure — no React, no DOM, no clock — so every threshold below is asserted in
 * tests instead of eyeballed in a session.
 */

/**
 * Never finalize faster than this, whatever the classifier says.
 *
 * Mirrors the floor the shared useSpeechEndDetection hook already applies
 * ("Aphasic speech is full of long inter-word pauses; finalizing under ~1s
 * cuts people off mid-thought"), but set far higher because this task expects
 * the person to stop, think, and start a new sentence — twice.
 */
export const DG_MIN_SILENCE_MS = 4000;

/**
 * While fewer than this many of the three feature types have been covered,
 * wait longer still: the answer is demonstrably unfinished, so a pause is far
 * more likely to be word-finding than a full stop.
 */
export const DG_COVERAGE_TARGET = 2;
export const DG_THIN_COVERAGE_SILENCE_MS = 7000;

/**
 * Backstop. Past this much listening, a reasonable pause ends the turn even if
 * coverage is thin — otherwise a quiet trial could hold the session open.
 */
export const DG_BACKSTOP_ELAPSED_MS = 75_000;
export const DG_BACKSTOP_SILENCE_MS = 1500;

/**
 * Hard cap. Guarantees termination.
 *
 * There is NO maximum-listening cap anywhere else in this game: every other
 * path out of a trial needs either a silence threshold to be crossed or the
 * person to press something. Raising the silence floor without this would make
 * it possible for a trial to never end on its own — trading a cut-off for a
 * stuck session, which is worse.
 */
export const DG_HARD_CAP_MS = 120_000;

export interface AutoSubmitInput {
  /** Time since the transcript last grew. */
  silenceMs: number;
  /** Time since the mic opened for this attempt. */
  elapsedMs: number;
  /** How many of the three feature types have been covered so far (0-3). */
  featureCount: number;
  /** Threshold the shared profile + classifier would have used, in ms. */
  classifierThresholdMs: number;
  /** The shared classifier's request to stay quiet (struggling, reading, …). */
  suppressAutoSubmit: boolean;
}

export interface AutoSubmitDecision {
  shouldEvaluate: boolean;
  /** The threshold actually applied, for logging and tests. */
  thresholdMs: number;
  /** Why — useful in logs when a session behaves oddly in the field. */
  reason: 'hard-cap' | 'backstop' | 'suppressed' | 'thin-coverage' | 'silence' | 'waiting';
}

/**
 * Decide whether the person has finished describing.
 *
 * Order matters: the hard cap outranks everything (a trial must always be able
 * to end), then the backstop, then the classifier's request for patience, and
 * only then the silence thresholds.
 */
export function decideAutoSubmit(input: AutoSubmitInput): AutoSubmitDecision {
  const { silenceMs, elapsedMs, featureCount, classifierThresholdMs, suppressAutoSubmit } = input;

  if (elapsedMs >= DG_HARD_CAP_MS) {
    return { shouldEvaluate: true, thresholdMs: 0, reason: 'hard-cap' };
  }

  if (elapsedMs >= DG_BACKSTOP_ELAPSED_MS && silenceMs >= DG_BACKSTOP_SILENCE_MS) {
    return { shouldEvaluate: true, thresholdMs: DG_BACKSTOP_SILENCE_MS, reason: 'backstop' };
  }

  // The classifier still owns "they are clearly mid-struggle" — we only ever
  // make it MORE patient, never less.
  if (suppressAutoSubmit) {
    return { shouldEvaluate: false, thresholdMs: Number.POSITIVE_INFINITY, reason: 'suppressed' };
  }

  const thinCoverage = featureCount < DG_COVERAGE_TARGET;
  const thresholdMs = Math.max(
    classifierThresholdMs,
    DG_MIN_SILENCE_MS,
    thinCoverage ? DG_THIN_COVERAGE_SILENCE_MS : 0
  );

  if (silenceMs >= thresholdMs) {
    return { shouldEvaluate: true, thresholdMs, reason: thinCoverage ? 'thin-coverage' : 'silence' };
  }

  return { shouldEvaluate: false, thresholdMs, reason: 'waiting' };
}
