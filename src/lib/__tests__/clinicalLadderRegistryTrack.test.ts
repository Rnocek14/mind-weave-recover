/**
 * Leak 2 — track/adoption consistency tests for the clinical ladder registry.
 *
 * The registry's track field is the authoritative mastery-track source.
 * A module-load assertion enforces that:
 *   - every adopted slug carries track: 'expressive'
 *   - receptive/non-linguistic slugs are NOT adopted
 *
 * If either side drifts, importing the registry throws — these tests
 * verify the live registry passes, and that `getTrackForSlug` reads the
 * field correctly for representative slugs across all three tracks.
 */

import { describe, it, expect } from 'vitest';
import {
  CLINICAL_LADDER_REGISTRY,
  getTrackForSlug,
} from '@/lib/clinicalLadderRegistry';
import { isAdoptedForTrialMode } from '@/lib/mastery/masterySignalRouting';

describe('clinicalLadderRegistry track field (Leak 2)', () => {
  it('every adopted slug has track: "expressive"', () => {
    const violations: string[] = [];
    for (const entry of Object.values(CLINICAL_LADDER_REGISTRY)) {
      if (isAdoptedForTrialMode(entry.slug) && entry.track !== 'expressive') {
        violations.push(`${entry.slug}: track="${entry.track}"`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('receptive slugs are not adopted for trial-mode routing', () => {
    const violations: string[] = [];
    for (const entry of Object.values(CLINICAL_LADDER_REGISTRY)) {
      if (entry.track === 'receptive' && isAdoptedForTrialMode(entry.slug)) {
        violations.push(entry.slug);
      }
    }
    expect(violations).toEqual([]);
  });

  it('non-linguistic slugs are not adopted', () => {
    const violations: string[] = [];
    for (const entry of Object.values(CLINICAL_LADDER_REGISTRY)) {
      if (
        entry.track === 'non-linguistic' &&
        isAdoptedForTrialMode(entry.slug)
      ) {
        violations.push(entry.slug);
      }
    }
    expect(violations).toEqual([]);
  });

  it('every entry declares a track', () => {
    for (const entry of Object.values(CLINICAL_LADDER_REGISTRY)) {
      expect(entry.track).toMatch(/^(expressive|receptive|non-linguistic)$/);
    }
  });
});

describe('getTrackForSlug', () => {
  it('reads track for adopted expressive slug (underscore form)', () => {
    expect(getTrackForSlug('photo_naming')).toBe('expressive');
  });

  it('reads track for adopted expressive slug (hyphen form)', () => {
    expect(getTrackForSlug('photo-naming')).toBe('expressive');
  });

  it('reads track for receptive slug', () => {
    expect(getTrackForSlug('meaning_match')).toBe('receptive');
    expect(getTrackForSlug('minimal-pairs')).toBe('receptive');
    expect(getTrackForSlug('phonological_awareness')).toBe('receptive');
  });

  it('reads track for non-linguistic slug', () => {
    expect(getTrackForSlug('pattern_match')).toBe('non-linguistic');
  });

  it('handles multi-step-plan alias normalization', () => {
    // Registry uses 'multi-step-plan'; canonical underscore is
    // 'multi_step_planning'. Both must resolve to the same entry.
    expect(getTrackForSlug('multi-step-plan')).toBe('expressive');
    expect(getTrackForSlug('multi_step_planning')).toBe('expressive');
  });

  it('returns undefined for unknown slug', () => {
    expect(getTrackForSlug('not-a-real-game')).toBeUndefined();
  });
});
