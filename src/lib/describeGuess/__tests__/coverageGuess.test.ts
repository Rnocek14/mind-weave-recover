/**
 * Does the coverage rule actually identify the object?
 *
 * This is an evaluation over the whole trial bank, not a handful of unit
 * tests. The rule decides whether the app tells someone they succeeded, so the
 * two failure directions both matter and they pull against each other:
 *
 *   - MISS  — a real description not recognised. The person did the work and
 *             the app stayed silent. This is what the old semantic path did
 *             100% of the time.
 *   - FALSE HIT — a description of something ELSE accepted as this object.
 *             This tells someone they succeeded when they did not, which is
 *             the more damaging of the two and the one worth bounding hard.
 *
 * The cross-target sweep below is the real test: every trial's own keywords
 * are run against every OTHER trial in the bank.
 */
import { describe, it, expect } from 'vitest';
import { DESCRIBE_GUESS_BANK } from '@/data/describeGuessBank';
import {
  detectSpokenDimensions,
  evaluateCoverage,
  COVERAGE_DIMENSIONS_REQUIRED,
} from '@/lib/describeGuess/coverageGuess';

/** Build a plausible spoken description from N of a trial's own dimensions. */
function describeFromOwnKeywords(trial: typeof DESCRIBE_GUESS_BANK[number], dims: number): string {
  const entries = Object.entries(trial.featureKeywords).filter(([, kws]) => (kws?.length ?? 0) > 0);
  return entries
    .slice(0, dims)
    .map(([, kws]) => kws![0])
    .join(' and it is ');
}

const trialsWithTwoDimensions = DESCRIBE_GUESS_BANK.filter(
  (t) => Object.values(t.featureKeywords).filter((k) => (k?.length ?? 0) > 0).length >= 2
);

describe('the bank can support the rule at all', () => {
  it('nearly every trial has at least two dimensions of keywords', () => {
    // If this ever drops, the coverage rule silently stops being reachable
    // for those trials and they regress to the dead semantic path.
    const ratio = trialsWithTwoDimensions.length / DESCRIBE_GUESS_BANK.length;
    expect(ratio).toBeGreaterThan(0.9);
  });
});

describe('a real description is recognised', () => {
  it.each(trialsWithTwoDimensions.map((t) => [t.target, t] as const))(
    'recognises a two-dimension description of %s',
    (_target, trial) => {
      const spoken = describeFromOwnKeywords(trial, COVERAGE_DIMENSIONS_REQUIRED);
      const verdict = evaluateCoverage(spoken, trial);
      expect(verdict.described).toBe(true);
    }
  );

  it('recognises a natural sentence, not just keywords in a row', () => {
    const cup = DESCRIBE_GUESS_BANK.find((t) => t.target === 'cup');
    if (!cup) return;
    const dims = Object.entries(cup.featureKeywords).filter(([, k]) => (k?.length ?? 0) > 0);
    const spoken = `I can't remember the word but it's ${dims[0][1]![0]} and you find it ${dims[1][1]![0]}`;
    expect(evaluateCoverage(spoken, cup).described).toBe(true);
  });
});

describe('noise is not a description', () => {
  const noise = [
    'and at that she up',
    'um uh er well so',
    'I don\'t know',
    'the thing',
    '',
  ];

  it.each(noise)('rejects %j against every trial in the bank', (text) => {
    const hits = DESCRIBE_GUESS_BANK.filter((t) => evaluateCoverage(text, t).described);
    expect(hits.map((h) => h.target)).toEqual([]);
  });

  it('does not credit a dimension on a substring', () => {
    // "can" must not be matched inside "candle"; this was a real defect.
    // Single-word keywords only: gluing onto a MULTI-word keyword leaves its
    // earlier words intact as genuine whole words ("sea creaturexyz" really
    // does contain "sea"), so those are correct detections, not substring
    // bugs.
    for (const trial of DESCRIBE_GUESS_BANK) {
      for (const [dimension, kws] of Object.entries(trial.featureKeywords)) {
        for (const kw of kws ?? []) {
          if (kw.length < 3 || kw.includes(' ')) continue;
          expect(detectSpokenDimensions(`${kw}xyz`, trial)).not.toContain(dimension);
        }
      }
    }
  });
});

describe('cross-target sweep — describing one thing must not identify another', () => {
  it('reports the false-hit rate across every ordered pair in the bank', () => {
    let pairs = 0;
    let falseHits = 0;
    const examples: string[] = [];

    for (const source of trialsWithTwoDimensions) {
      const spoken = describeFromOwnKeywords(source, 3);
      for (const other of DESCRIBE_GUESS_BANK) {
        if (other.id === source.id) continue;
        pairs += 1;
        if (evaluateCoverage(spoken, other).described) {
          falseHits += 1;
          if (examples.length < 12) examples.push(`${source.target} -> ${other.target}`);
        }
      }
    }

    const rate = falseHits / pairs;
    console.log(
      `[coverage] cross-target false hits: ${falseHits}/${pairs} (${(rate * 100).toFixed(2)}%)`,
      examples
    );

    // WHAT THIS BOUND IS FOR, since the honest answer is not "correctness":
    //
    // The measured collisions are all generic keywords — cup=>spoon via
    // "kitchen"+"round", dog=>cat via "pet"+"house"+"fur". In the game the
    // person is looking at a PICTURE of the target, so the app is never asked
    // to discriminate between two objects; it only asks whether the
    // description of the thing in front of them touched two of its
    // dimensions. "It's in the kitchen and it's round" IS a successful
    // communicative act about a cup when a cup is what you are both looking
    // at, which is exactly the skill being practiced.
    //
    // The obvious tightening — requiring at least one keyword distinctive to
    // the trial — was tried and rejected: it denies credit for that same
    // legitimate description. Trading real misses for a lower collision rate
    // is backwards for a game whose defect was denying people credit.
    //
    // So this bounds KEYWORD GENERICNESS as a regression detector: if someone
    // adds a batch of vague keywords to the bank, this number climbs and the
    // offending pairs are printed above. It is not a correctness threshold.
    expect(rate).toBeLessThan(0.05);
  });
});
