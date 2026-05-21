/**
 * PR7 — clinical integrity derivation tests.
 *
 * Round-trips `deriveTierStatusFromSpec` across the three real ladders and
 * pins the expected status pattern. If a future spec change demotes/promotes
 * a tier, the test fails loudly so the clinician-facing UI cannot drift
 * silently.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveTierStatusFromSpec,
  KNOWN_CAVEATS,
  scanForBannedPhrases,
  ALLOWED_HEDGED,
} from '@/lib/clinicalIntegrity';
import { PHOTO_NAMING_LEVELS } from '../photoNamingLevels';
import { FIX_SENTENCE_LEVELS } from '../fixSentenceLevels';
import { MINIMAL_PAIRS_LEVELS } from '../minimalPairsLevels';

describe('deriveTierStatusFromSpec', () => {
  it('Photo Naming: L1–L6 implemented, L7 partial (carrier caveat), L8 partial (probe overlap)', () => {
    const expected: Array<['implemented' | 'partially-implemented' | 'planned']> = [
      ['implemented'], ['implemented'], ['implemented'], ['implemented'],
      ['implemented'], ['implemented'],
      ['partially-implemented'], ['partially-implemented'],
    ];
    for (let lvl = 1; lvl <= 8; lvl++) {
      const r = deriveTierStatusFromSpec('photo-naming', lvl, PHOTO_NAMING_LEVELS[lvl]);
      expect(r.tierStatus).toBe(expected[lvl - 1][0]);
      expect(r.tierStatusDetail.length).toBeGreaterThan(8);
    }
  });

  it('Fix Sentence: L1–L4 implemented, L5–L8 planned', () => {
    for (let lvl = 1; lvl <= 4; lvl++) {
      expect(deriveTierStatusFromSpec('fix-sentence', lvl, FIX_SENTENCE_LEVELS[lvl]).tierStatus)
        .toBe('implemented');
    }
    for (let lvl = 5; lvl <= 8; lvl++) {
      expect(deriveTierStatusFromSpec('fix-sentence', lvl, FIX_SENTENCE_LEVELS[lvl]).tierStatus)
        .toBe('planned');
    }
  });

  it('Minimal Pairs: L1–L6 implemented, L7–L8 planned', () => {
    for (let lvl = 1; lvl <= 6; lvl++) {
      expect(deriveTierStatusFromSpec('minimal-pairs', lvl, MINIMAL_PAIRS_LEVELS[lvl]).tierStatus)
        .toBe('implemented');
    }
    for (let lvl = 7; lvl <= 8; lvl++) {
      expect(deriveTierStatusFromSpec('minimal-pairs', lvl, MINIMAL_PAIRS_LEVELS[lvl]).tierStatus)
        .toBe('planned');
    }
  });

  it('KNOWN_CAVEATS only references slugs that exist in the registry', () => {
    const slugs = Object.keys(KNOWN_CAVEATS);
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      expect(['photo-naming', 'fix-sentence', 'minimal-pairs']).toContain(slug);
    }
  });
});

describe('scanForBannedPhrases', () => {
  it('flags raw banned phrases', () => {
    expect(scanForBannedPhrases('the patient mastered this level').length).toBe(1);
    expect(scanForBannedPhrases('clinically validated outcome').length).toBeGreaterThanOrEqual(1);
  });
  it('respects hedged contexts', () => {
    expect(scanForBannedPhrases('this is a generalization probe attempt')).toEqual([]);
    expect(scanForBannedPhrases('clinically motivated calibration defaults')).toEqual([]);
  });
  it('does not false-positive on "validity" / "validate forms"', () => {
    expect(scanForBannedPhrases('input validity gate')).toEqual([]);
    expect(scanForBannedPhrases('we validate the form before submit')).toEqual([]);
  });
  it('ALLOWED_HEDGED is non-empty and lowercase', () => {
    expect(ALLOWED_HEDGED.length).toBeGreaterThan(0);
    for (const p of ALLOWED_HEDGED) expect(p).toBe(p.toLowerCase());
  });
});
