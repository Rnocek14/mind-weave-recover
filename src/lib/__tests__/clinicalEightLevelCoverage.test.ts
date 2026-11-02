import { describe, expect, it } from 'vitest';
import { CANONICAL_EXERCISES } from '@/data/canonicalExerciseRegistry';
import { CLINICAL_LADDER_REGISTRY, getTrackForSlug } from '../clinicalLadderRegistry';
import { getEightLevelCoverage, summarizeEightLevelCoverage, LIVE_GAME_LEVEL_CEILINGS } from '../clinicalEightLevelCoverage';
import { UNWIRED_EXERCISE_LEVELS } from '../progression/unwiredExerciseLevels';
import { isAdoptedForTrialMode } from '../mastery/masterySignalRouting';
import { isRungImplemented } from '../progression/_shared/implementedCeiling';

describe('every canonical game gets eight authored stages, but no fake clinical enforcement', () => {
  const canonical = CANONICAL_EXERCISES.map(ex => ex.slug);

  it('covers every canonical exercise plus noncanonical patient Command Scenes', () => {
    const report = summarizeEightLevelCoverage();
    expect(canonical).toHaveLength(28);
    expect(new Set(canonical).size).toBe(28);
    expect(report).toMatchObject({
      canonicalGames: 28,
      supplementalGames: 1,
      withEightDefinedLevels: 29,
      liveProgressionGames: 13,
      designOnlyGames: 16,
      gaps: [],
    });
    expect(CLINICAL_LADDER_REGISTRY['functional-scenes']).toBeDefined();
  });

  it('covers the EXACT contiguous set of levels 1 through 8 for every game, including the 16 design-only ladders', () => {
    for (const entry of Object.values(CLINICAL_LADDER_REGISTRY)) {
      const rows = entry.rows ?? [];
      expect(rows.map(r => r.level), entry.slug).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      for (const row of rows) {
        expect(row.description.trim().length, entry.slug + ' L' + row.level).toBeGreaterThan(10);
        expect(row.targetSupport, entry.slug + ' L' + row.level).toBeTruthy();
      }
    }
  });

  it('reconciles all 13 live progression ceilings with their real content selectors', () => {
    const coverage = getEightLevelCoverage();
    const wired = coverage.filter(row => row.liveProgression);
    expect(wired).toHaveLength(13);
    for (const entry of wired) {
      expect(entry.liveCeiling).toBe(LIVE_GAME_LEVEL_CEILINGS[entry.slug]());
      expect(entry.liveCeiling).toBeGreaterThanOrEqual(1);
      expect(entry.liveCeiling).toBeLessThanOrEqual(8);
      expect(entry.problems, entry.slug).toEqual([]);
      if (entry.liveCeiling! < 8) {
        expect(entry.status).toBe('structural');
        expect(entry.plannedLevels).toBeGreaterThan(0);
      }
    }
  });

  it('does not promote design-only stages to implemented, scoreable or adopted levels', () => {
    for (const entry of getEightLevelCoverage()) {
      if (entry.status !== 'design-only') continue;
      expect(entry.liveProgression, entry.slug).toBe(false);
      expect(entry.liveCeiling, entry.slug).toBeNull();
      expect(entry.plannedLevels, entry.slug).toBe(8);
      expect(entry.problems, entry.slug).toEqual([]);
      expect(isAdoptedForTrialMode(entry.slug), entry.slug).toBe(false);
      for (const row of CLINICAL_LADDER_REGISTRY[entry.slug].rows ?? []) {
        expect(row.tierStatus).toBe('planned');
        expect(row.minOnTargetAttempts).toBeUndefined();
        expect(row.minOnTargetAccuracy).toBeUndefined();
      }
    }
  });

  it('keeps motor/visual practice out of the expressive and receptive aphasia mastery tracks', () => {
    for (const slug of ['reach-tap', 'left-side-hunt', 'pattern-match']) {
      const ladder = CLINICAL_LADDER_REGISTRY[slug];
      expect(ladder.track).toBe('non-linguistic');
      expect(getTrackForSlug(slug)).toBe('non-linguistic');
      expect(isAdoptedForTrialMode(slug)).toBe(false);
      expect(ladder.rows?.every(row => row.targetSupport !== 'open_response' &&
        row.targetSupport !== 'independent' && row.tierStatus === 'planned')).toBe(true);
    }
  });

  it('every newly designed L1–L8 table has no hidden implementation or numeric mastery threshold', () => {
    expect(Object.keys(UNWIRED_EXERCISE_LEVELS)).toHaveLength(10);
    for (const [slug, table] of Object.entries(UNWIRED_EXERCISE_LEVELS)) {
      expect(CLINICAL_LADDER_REGISTRY[slug]).toBeTruthy();
      expect(Object.keys(table).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      const selectors = new Set<string>();
      for (const level of Object.values(table)) {
        expect(level.readiness).toBe('aspirational');
        expect(level.contentSelector.implemented).toBe(false);
        expect(isRungImplemented(level)).toBe(false);
        expect(level.contentSelector.description).toContain('not playable');
        selectors.add(level.contentSelector.tierKey);
      }
      expect(selectors.size).toBe(8);
    }
  });

  it('a new unrelated exercise or newly registered level cannot silently disappear from the coverage contract', () => {
    const canonical = new Set(CANONICAL_EXERCISES.map(x => x.slug));
    const registry = new Set(Object.keys(CLINICAL_LADDER_REGISTRY));
    for (const slug of canonical) expect(registry.has(slug), slug).toBe(true);
    for (const slug of registry) expect(canonical.has(slug) || slug === 'functional-scenes', slug).toBe(true);
    expect(getEightLevelCoverage().every(row => row.problems.length === 0)).toBe(true);
  });

  it('keeps non-clinical mini-games and modality flows outside automatic eight-level promotion', () => {
    expect(CLINICAL_LADDER_REGISTRY['feed-the-monster']).toBeUndefined();
    expect(CLINICAL_LADDER_REGISTRY['voice-practice']).toBeUndefined();
    // These require separate pediatric consent or functional audio design, not
    // a synthetic grade inserted into the adult aphasia mastery track.
  });
});
