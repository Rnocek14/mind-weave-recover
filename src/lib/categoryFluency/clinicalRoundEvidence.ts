/**
 * Comparable category-fluency practice evidence.
 *
 * These are operational telemetry rules, not validated normative cutoffs or
 * a claim that a game score measures aphasia recovery. Do not treat a typed
 * response, an example-cued response, or a nonresponse as independent speech.
 * Keep the duration constant so content difficulty is not confounded by time.
 */
export const COMPARABLE_FLUENCY_SECONDS = 60;

export type FluencyInputMode = 'spoken' | 'typed' | 'mixed' | 'none';

export function getFluencyInputMode(
  spokenValidWords: number,
  typedValidWords: number,
): FluencyInputMode {
  const spoken = Number.isFinite(spokenValidWords) && spokenValidWords > 0;
  const typed = Number.isFinite(typedValidWords) && typedValidWords > 0;
  if (spoken && typed) return 'mixed';
  if (spoken) return 'spoken';
  if (typed) return 'typed';
  return 'none';
}

/** A displayed example is a semantic cue even if the patient didn't tap it. */
export function getFluencyCueLevel(
  examplesWereVisible: boolean,
  extraExampleRequests: number,
): number {
  if (!examplesWereVisible) return 0;
  const count = Number.isFinite(extraExampleRequests)
    ? Math.max(0, Math.floor(extraExampleRequests)) : 0;
  return Math.min(3, 1 + count);
}

/**
 * Return separate practice versus speech-evidence classifications.
 * Cued spoken output remains worthwhile practice but does not enter the
 * independent expressive mastery stream. Typed and silent attempts stay
 * visible in exercise telemetry but cannot promote the spoken clinical ladder.
 */
export function classifyFluencyRoundEvidence(args: {
  mode: FluencyInputMode;
  cueLevelUsed: number;
  uniqueWordCount: number;
  timeLimitSec: number;
  /** Actual rounded elapsed time, not just the round's planned cap. */
  actualDurationSec: number;
}): {
  trialMode: 'production' | 'scaffolded' | 'mixed';
  clinicalProgressionEligible: boolean;
  independentSpoken: boolean;
} {
  const spoken = args.mode === 'spoken' && args.uniqueWordCount > 0;
  // An early stop must not masquerade as a complete one-minute probe.
  const comparable = args.timeLimitSec === COMPARABLE_FLUENCY_SECONDS &&
    Number.isFinite(args.actualDurationSec) &&
    args.actualDurationSec >= COMPARABLE_FLUENCY_SECONDS - 1;
  const cued = args.cueLevelUsed > 0;
  return {
    trialMode: !spoken || !comparable ? 'mixed' : cued ? 'scaffolded' : 'production',
    clinicalProgressionEligible: spoken && comparable,
    independentSpoken: spoken && comparable && !cued,
  };
}

/** The generic adaptive engine chooses a broad category BANK, not the time. */
export function categoryTierIndexForDifficulty(difficulty: number, tierCount: number): number {
  if (!Number.isFinite(difficulty) || tierCount <= 0) return 0;
  return Math.max(0, Math.min(Math.floor((difficulty - 1) / 2), tierCount - 1));
}
