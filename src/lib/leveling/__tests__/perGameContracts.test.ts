/**
 * Contract consistency tests for the Per-Game Leveling Contract registry.
 *
 * These are pure, runtime-free guardrails that catch drift between the
 * spec, the registry, the slug normalizer, and the actual content banks.
 * They do NOT exercise live gameplay or the in-game adaptation engine.
 */
import { describe, it, expect } from 'vitest';
import {
  PER_GAME_CONTRACTS,
  PER_GAME_CONTRACTS_VERSION,
  getPerGameContract,
  type PerGameLevelingContract,
} from '../perGameContracts';
import {
  CANONICAL_SLUGS,
  normalizeExerciseSlug,
} from '@/lib/exerciseSlugNormalizer';

const CANONICAL_VALUES = Object.values(CANONICAL_SLUGS) as string[];

describe('perGameContracts — registry shape', () => {
  it('has a non-empty version string', () => {
    expect(typeof PER_GAME_CONTRACTS_VERSION).toBe('string');
    expect(PER_GAME_CONTRACTS_VERSION.length).toBeGreaterThan(0);
  });

  it('has at least one contract', () => {
    expect(Object.keys(PER_GAME_CONTRACTS).length).toBeGreaterThan(0);
  });

  it('every key matches the contract.slug it points to (no duplicate slugs)', () => {
    const seen = new Set<string>();
    for (const [key, contract] of Object.entries(PER_GAME_CONTRACTS)) {
      expect(contract.slug).toBe(key);
      expect(seen.has(contract.slug)).toBe(false);
      seen.add(contract.slug);
    }
  });
});

describe('perGameContracts — slug discipline', () => {
  it('every slug is canonical (matches normalizeExerciseSlug output)', () => {
    for (const slug of Object.keys(PER_GAME_CONTRACTS)) {
      expect(normalizeExerciseSlug(slug)).toBe(slug);
    }
  });

  it('every slug is registered in CANONICAL_SLUGS', () => {
    for (const slug of Object.keys(PER_GAME_CONTRACTS)) {
      expect(CANONICAL_VALUES).toContain(slug);
    }
  });

  it('getPerGameContract returns the same object as direct lookup', () => {
    for (const slug of Object.keys(PER_GAME_CONTRACTS)) {
      expect(getPerGameContract(slug)).toBe(PER_GAME_CONTRACTS[slug]);
    }
    expect(getPerGameContract('definitely_not_a_game')).toBeNull();
  });
});

describe('perGameContracts — value sanity', () => {
  const entries = Object.entries(PER_GAME_CONTRACTS) as [string, PerGameLevelingContract][];

  it.each(entries)('%s — internalScale is a valid range', (_slug, c) => {
    expect(Number.isInteger(c.internalScale.min)).toBe(true);
    expect(Number.isInteger(c.internalScale.max)).toBe(true);
    expect(c.internalScale.min).toBeGreaterThanOrEqual(1);
    expect(c.internalScale.max).toBeGreaterThanOrEqual(c.internalScale.min);
    expect(c.internalScale.max).toBeLessThanOrEqual(10);
  });

  it.each(entries)('%s — has at least one difficulty driver and one support driver', (_slug, c) => {
    expect(c.difficultyDrivers.length).toBeGreaterThan(0);
    expect(c.supportDrivers.length).toBeGreaterThan(0);
    for (const d of c.difficultyDrivers) expect(d.trim().length).toBeGreaterThan(0);
    for (const s of c.supportDrivers) expect(s.trim().length).toBeGreaterThan(0);
  });

  it.each(entries)('%s — fastClimb thresholds are sane', (_slug, c) => {
    expect(c.fastClimb.upToLevel).toBeGreaterThanOrEqual(2);
    expect(c.fastClimb.upToLevel).toBeLessThanOrEqual(6);
    expect(c.fastClimb.consecutiveStrongTrials).toBeGreaterThanOrEqual(2);
    expect(c.fastClimb.consecutiveStrongTrials).toBeLessThanOrEqual(6);
  });

  it.each(entries)('%s — hardRegression rules are conservative', (_slug, c) => {
    expect(c.hardRegression.minPoorSessions).toBeGreaterThanOrEqual(2);
    expect(c.hardRegression.cueIndependenceFloor).toBeGreaterThan(0);
    expect(c.hardRegression.cueIndependenceFloor).toBeLessThan(1);
  });

  it.each(entries)('%s — progressWeights are monotonic and bounded', (_slug, c) => {
    const w = c.progressWeights;
    for (const v of Object.values(w)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // unaided correct must be the highest-value trial outcome.
    expect(w.correctNoCue).toBeGreaterThan(w.correctLightCue);
    expect(w.correctLightCue).toBeGreaterThan(w.correctHeavyCue);
    expect(w.correctHeavyCue).toBeGreaterThanOrEqual(w.incorrect);
    expect(w.incorrect).toBeGreaterThanOrEqual(w.skip);
  });

  it.each(entries)('%s — readiness + risk fields are valid enums', (_slug, c) => {
    expect(['ready', 'needs_bank_expansion', 'needs_tier_tagging', 'shadow_only']).toContain(
      c.contentReadiness,
    );
    expect(['low', 'medium', 'high']).toContain(c.wiringRisk);
  });

  it('high-risk contracts are not marked as ready-to-wire without a note', () => {
    for (const c of Object.values(PER_GAME_CONTRACTS)) {
      if (c.wiringRisk === 'high') {
        expect(c.contentReadiness).not.toBe('ready');
      }
      if (c.contentReadiness !== 'ready') {
        expect(c.notes && c.notes.length > 0).toBe(true);
      }
    }
  });
});
