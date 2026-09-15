/**
 * Describe & Guess — deciding whether the description actually described it.
 *
 * WHY NOT EMBEDDINGS ALONE: getSemanticSimilarity is a NETWORK call that
 * silently degrades to a rule-based fallback when it fails, and it caps
 * similarity at 0.45 whenever the spoken text shares no words with the target
 * — which a circumlocution never does, by definition. Every guess rule sat
 * above that ceiling, so the documented "2-of-3 rule" could not fire in
 * production. The app guessed for unrelated reasons and stayed silent when the
 * description was perfect.
 *
 * WHAT THIS USES INSTEAD: the trial bank already contains the right answer.
 * Each trial carries hand-authored keywords per dimension — what it looks
 * like, where you find it, what it is used for, what it is made of, what kind
 * of thing it is. Saying words from two or more of THIS trial's dimension
 * lists is a direct, deterministic, offline demonstration that the person
 * described THIS object. That is also the clinical definition of successful
 * circumlocution, which makes it the right thing to reward rather than a
 * convenient proxy.
 *
 * Pure — no network, no React — so it can be evaluated against the whole bank
 * in tests instead of guessed at in a session.
 */

import type { DescribeGuessTrial, FeatureType } from '@/data/describeGuessBank';

/**
 * How many dimensions have to be covered before we call it described.
 *
 * Two, not one: a single dimension is frequently generic ("it's in the
 * kitchen" fits dozens of objects), while two trial-specific dimensions
 * together are strongly identifying. Raising it to three would punish the
 * common and perfectly successful two-part description.
 */
export const COVERAGE_DIMENSIONS_REQUIRED = 2;

/** Normalize once, with word boundaries, so "can" cannot match "candle". */
function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

/**
 * Which of this trial's dimensions the person actually spoke about.
 *
 * Word-boundary matched. Multi-word keywords match as contiguous phrases.
 */
export function detectSpokenDimensions(
  transcript: string,
  trial: DescribeGuessTrial
): FeatureType[] {
  if (!transcript) return [];
  const haystack = normalize(transcript);
  const found: FeatureType[] = [];

  for (const [dimension, keywords] of Object.entries(trial.featureKeywords)) {
    const hit = keywords?.some((kw) => {
      const needle = normalize(kw).trim();
      return needle.length > 0 && haystack.includes(` ${needle} `);
    });
    if (hit) found.push(dimension as FeatureType);
  }
  return found;
}

export interface CoverageVerdict {
  /** Dimensions of THIS trial the description touched. */
  dimensions: FeatureType[];
  /** Enough trial-specific dimensions to conclude they described this object. */
  described: boolean;
}

export function evaluateCoverage(
  transcript: string,
  trial: DescribeGuessTrial
): CoverageVerdict {
  const dimensions = detectSpokenDimensions(transcript, trial);
  return {
    dimensions,
    described: dimensions.length >= COVERAGE_DIMENSIONS_REQUIRED,
  };
}
