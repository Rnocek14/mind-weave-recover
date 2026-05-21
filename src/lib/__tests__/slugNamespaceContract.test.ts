/**
 * Slug namespace contract guard.
 *
 * Enforces the contract documented in docs/unified-trial-contract.md
 * §"Slug namespaces":
 *
 *   - Telemetry-side constants in CANONICAL_SLUGS use the underscore form.
 *   - Progression-side per-game constants (used as keys into
 *     clinical_progression_state and the per-game level/intensity modules)
 *     use the hyphenated form.
 *   - toProgressionSlug / toTelemetrySlug are the only sanctioned converters.
 *
 * If this test fails, do NOT hand-roll a string.replace at a call site —
 * route through the converter instead, or update the contract.
 */

import { describe, it, expect } from 'vitest';
import {
  CANONICAL_SLUGS,
  normalizeExerciseSlug,
  toProgressionSlug,
  toTelemetrySlug,
} from '../exerciseSlugNormalizer';
import { PHOTO_NAMING_SLUG } from '../intensity/photoNamingIntensity';
import { FIX_SENTENCE_SLUG } from '../intensity/fixSentenceIntensity';
import { MINIMAL_PAIRS_SLUG } from '../intensity/minimalPairsIntensity';

describe('slug namespace contract', () => {
  it('telemetry constants are underscore-form, never hyphenated', () => {
    for (const value of Object.values(CANONICAL_SLUGS)) {
      expect(value).not.toMatch(/-/);
      expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('progression-side per-game slug constants are hyphenated', () => {
    expect(PHOTO_NAMING_SLUG).toBe('photo-naming');
    expect(FIX_SENTENCE_SLUG).toBe('fix-sentence');
    expect(MINIMAL_PAIRS_SLUG).toBe('minimal-pairs');
  });

  it('toProgressionSlug round-trips through toTelemetrySlug', () => {
    const cases = [
      ['photo_naming', 'photo-naming'],
      ['fix_sentence', 'fix-sentence'],
      ['minimal_pairs', 'minimal-pairs'],
    ] as const;
    for (const [tel, prog] of cases) {
      expect(toProgressionSlug(tel)).toBe(prog);
      expect(toTelemetrySlug(prog)).toBe(tel);
      // Idempotency: passing the already-canonical form returns the same.
      expect(toProgressionSlug(prog)).toBe(prog);
      expect(toTelemetrySlug(tel)).toBe(tel);
    }
  });

  it('normalizeExerciseSlug always returns the telemetry (underscore) form', () => {
    expect(normalizeExerciseSlug('photo-naming')).toBe('photo_naming');
    expect(normalizeExerciseSlug('PHOTO-NAMING')).toBe('photo_naming');
    expect(normalizeExerciseSlug('photo_naming')).toBe('photo_naming');
  });

  it('progression-side per-game slug matches toProgressionSlug(telemetry slug)', () => {
    expect(toProgressionSlug(CANONICAL_SLUGS.PHOTO_NAMING)).toBe(PHOTO_NAMING_SLUG);
    expect(toProgressionSlug(CANONICAL_SLUGS.FIX_SENTENCE)).toBe(FIX_SENTENCE_SLUG);
    expect(toProgressionSlug(CANONICAL_SLUGS.MINIMAL_PAIRS)).toBe(MINIMAL_PAIRS_SLUG);
  });
});
