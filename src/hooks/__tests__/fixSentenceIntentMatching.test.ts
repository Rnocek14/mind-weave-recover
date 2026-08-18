/**
 * Fix Sentence — full-bank intent-matching battery.
 *
 * Sweeps EVERY trial in all three banks (single-error, two-error,
 * morphology) against the utterance shapes real patients produce:
 *   - the bare fix / "the <fix>"
 *   - the fix inside a carrier phrase or the whole corrected sentence
 *   - the fix repeated, or preceded by a negation of the error
 *   - a phonetically distorted form of the fix (intent tolerance)
 * and the shapes that must NEVER score:
 *   - the wrong sentence read back verbatim
 *   - the wrong word itself (incl. morphology base forms — the ±s
 *     tolerance must not bridge "apple" → "apples")
 *   - function words near a fix ("can" → "pan"), long discourse fuzzing,
 *     unrelated words.
 *
 * Pure-function level (matchSpokenFix / matchApproximateFix) so the whole
 * bank can be swept deterministically.
 */
import { describe, it, expect } from 'vitest';
import { matchSpokenFix, matchApproximateFix } from '@/hooks/useFixSentenceGame';
import {
  FIX_SENTENCE_BANK,
  FIX_SENTENCE_TWO_ERROR_BANK,
  FIX_SENTENCE_MORPHOLOGY_BANK,
  type FixSentenceTrial,
} from '@/data/fixSentenceBank';

const ALL_TRIALS: FixSentenceTrial[] = [
  ...FIX_SENTENCE_BANK,
  ...FIX_SENTENCE_TWO_ERROR_BANK,
  ...FIX_SENTENCE_MORPHOLOGY_BANK,
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const sentenceTokens = (t: FixSentenceTrial) => new Set(norm(t.sentence).split(' '));
const fixInOwnSentence = (t: FixSentenceTrial, fix: string): boolean => {
  const toks = norm(t.sentence).split(' ');
  const parts = norm(fix).split(' ');
  for (let i = 0; i <= toks.length - parts.length; i++) {
    if (parts.every((p, j) => toks[i + j] === p)) return true;
  }
  return false;
};

const match = (t: FixSentenceTrial, spoken: string) =>
  matchSpokenFix(spoken, t.acceptedFixes, t.fixAliases, t.sentence, {
    pluralTolerance: !t.morphology,
  });

describe('matchSpokenFix — full-bank acceptance sweep', () => {
  it('accepts the bare fix for every trial and every accepted fix', () => {
    for (const t of ALL_TRIALS) {
      for (const fix of t.acceptedFixes) {
        // Sets like ['hand','hands'] may resolve to a ±s sibling — any
        // member of the accepted set is a correct return.
        expect(t.acceptedFixes, `${t.id} bare "${fix}"`).toContain(match(t, fix));
      }
      if (t.secondError) {
        for (const fix of t.secondError.acceptedFixes) {
          const m = matchSpokenFix(fix, t.secondError.acceptedFixes, t.secondError.fixAliases, t.sentence);
          expect(t.secondError.acceptedFixes, `${t.id} secondError bare "${fix}"`).toContain(m);
        }
      }
    }
  });

  it('accepts "the <fix>" for every trial', () => {
    for (const t of ALL_TRIALS) {
      const fix = t.acceptedFixes[0];
      expect(match(t, `the ${fix}`), `${t.id} "the ${fix}"`).toBe(fix);
    }
  });

  it('accepts the fix inside a carrier phrase (unless the fix occurs in the trial sentence)', () => {
    let skipped = 0;
    for (const t of ALL_TRIALS) {
      const fix = t.acceptedFixes[0];
      if (fixInOwnSentence(t, fix)) { skipped++; continue; }
      expect(match(t, `i think it should be ${fix} instead`), `${t.id} carrier "${fix}"`).toBe(fix);
    }
    // Known self-containing items (fs_53 "oven", fs_88 "doorbell", …): a
    // handful at most — those fall through to the semantic fallback in-game.
    expect(skipped).toBeLessThanOrEqual(4);
  });

  it('accepts the whole corrected sentence', () => {
    for (const t of ALL_TRIALS) {
      const fix = t.acceptedFixes[0];
      if (fixInOwnSentence(t, fix)) continue;
      const corrected = t.sentence.toLowerCase().replace(t.wrongWord.toLowerCase(), fix.toLowerCase());
      expect(match(t, corrected), `${t.id} corrected sentence`).toBe(fix);
    }
  });

  it('accepts the fix repeated twice and negate-then-correct phrasing', () => {
    for (const t of ALL_TRIALS) {
      const fix = t.acceptedFixes[0];
      if (fixInOwnSentence(t, fix)) continue;
      expect(match(t, `${fix} ${fix}`), `${t.id} repeated "${fix}"`).toBe(fix);
      expect(match(t, `not ${t.wrongWord} ${fix}`), `${t.id} negation "${fix}"`).toBe(fix);
    }
  });
});

describe('matchSpokenFix — full-bank rejection sweep', () => {
  it('NEVER matches the wrong sentence read back verbatim', () => {
    for (const t of ALL_TRIALS) {
      expect(match(t, t.sentence), `${t.id} verbatim sentence`).toBeNull();
      if (t.secondError) {
        const m = matchSpokenFix(t.sentence, t.secondError.acceptedFixes, t.secondError.fixAliases, t.sentence);
        expect(m, `${t.id} verbatim vs secondError`).toBeNull();
      }
    }
  });

  it('NEVER matches the bare wrong word (incl. morphology base forms)', () => {
    for (const t of ALL_TRIALS) {
      expect(match(t, t.wrongWord), `${t.id} wrongWord "${t.wrongWord}"`).toBeNull();
      if (t.morphology) {
        expect(match(t, t.morphology.baseForm), `${t.id} baseForm "${t.morphology.baseForm}"`).toBeNull();
        expect(match(t, t.morphology.erroneousForm), `${t.id} erroneousForm`).toBeNull();
      }
    }
  });

  it('rejects unrelated answers', () => {
    for (const t of ALL_TRIALS) {
      expect(match(t, 'quixotic mismatch'), `${t.id} unrelated`).toBeNull();
    }
  });
});

describe('matchApproximateFix — intent tolerance (phonetic near-miss)', () => {
  it('accepts a one-letter distortion of the fix across the single-error bank', () => {
    let covered = 0;
    for (const t of FIX_SENTENCE_BANK) {
      const fix = t.acceptedFixes.find(
        (f) => !f.includes(' ') && f.length >= 4 && !sentenceTokens(t).has(f.toLowerCase()),
      );
      if (!fix) continue;
      covered++;
      const distorted = fix.slice(0, -1) + (fix.endsWith('x') ? 'z' : 'x');
      const near = matchApproximateFix(distorted, t.acceptedFixes, t.sentence);
      expect(near, `${t.id} distorted "${distorted}"`).not.toBeNull();
      expect(near!.similarity).toBeGreaterThanOrEqual(0.6);
    }
    // The sweep must actually exercise most of the bank.
    expect(covered).toBeGreaterThan(FIX_SENTENCE_BANK.length * 0.7);
  });

  it('accepts a distortion inside a short carrier ("the wader")', () => {
    const t = FIX_SENTENCE_BANK.find((x) => x.id === 'fs_34')!; // fish swam in the sky → water
    expect(matchApproximateFix('the watter', t.acceptedFixes, t.sentence)).not.toBeNull();
    expect(matchApproximateFix('wader', t.acceptedFixes, t.sentence)).not.toBeNull();
  });

  it('accepts homophones the recognizer writes differently', () => {
    const t = FIX_SENTENCE_BANK.find((x) => x.id === 'fs_34')!; // fixes include "sea"
    const near = matchApproximateFix('see', t.acceptedFixes, t.sentence);
    expect(near).not.toBeNull();
    expect(near!.fix).toBe('sea');
    expect(near!.similarity).toBe(1);
  });

  it('NEVER fuzzy-matches the wrong word or any token of the trial sentence', () => {
    for (const t of ALL_TRIALS) {
      expect(matchApproximateFix(t.wrongWord, t.acceptedFixes, t.sentence), `${t.id} wrongWord`).toBeNull();
      expect(matchApproximateFix(t.sentence, t.acceptedFixes, t.sentence), `${t.id} sentence`).toBeNull();
    }
  });

  it('does not fuzz function words or long discourse', () => {
    const t = FIX_SENTENCE_BANK.find((x) => x.id === 'fs_38') ??
      FIX_SENTENCE_BANK.find((x) => x.acceptedFixes.includes('pan'));
    if (t) {
      // "can" is 1 edit from "pan" but carries no naming intent.
      expect(matchApproximateFix('can', t.acceptedFixes, t.sentence)).toBeNull();
    }
    const water = FIX_SENTENCE_BANK.find((x) => x.id === 'fs_34')!;
    // >3 content tokens → treated as discourse, no fuzzing.
    expect(
      matchApproximateFix('i really believe maybe something watter', water.acceptedFixes, water.sentence),
    ).toBeNull();
  });

  it('rejects unrelated words for every trial', () => {
    for (const t of ALL_TRIALS) {
      expect(matchApproximateFix('quixotic', t.acceptedFixes, t.sentence), `${t.id}`).toBeNull();
    }
  });
});
