import { describe, it, expect } from 'vitest';
import {
  evidenceMetForLevel,
  calculateLevelAwareProgressDelta,
  isOnTargetTrial,
  getPhotoNamingLevelSpec,
} from '../photoNamingLevels';
import type { SupportLevel } from '../clinicalProgression';

const trial = (correct: boolean, support: SupportLevel) => ({ correct, support });

describe('photoNamingLevels — level-specific evidence', () => {
  it('Level 1 graduates from chip-recovery (recognition_only) success', () => {
    const trials = Array.from({ length: 6 }, () => trial(true, 'recognition_only'));
    expect(evidenceMetForLevel(trials, 1)).toBe(true);
  });

  it('Level 1 graduates from semantic_cue success too (above target)', () => {
    const trials = Array.from({ length: 6 }, () => trial(true, 'semantic_cue'));
    expect(evidenceMetForLevel(trials, 1)).toBe(true);
  });

  it('Level 4 does NOT graduate from scaffolded chip recovery', () => {
    const trials = Array.from({ length: 8 }, () => trial(true, 'recognition_only'));
    expect(evidenceMetForLevel(trials, 4)).toBe(false);
  });

  it('Level 4 does NOT graduate from semantic_cue success', () => {
    const trials = Array.from({ length: 8 }, () => trial(true, 'semantic_cue'));
    expect(evidenceMetForLevel(trials, 4)).toBe(false);
  });

  it('Level 4 graduates from independent success at 70%+', () => {
    const trials = [
      ...Array.from({ length: 5 }, () => trial(true, 'independent')),
      ...Array.from({ length: 2 }, () => trial(false, 'independent')),
    ];
    expect(evidenceMetForLevel(trials, 4)).toBe(true);
  });

  it('on-target classification respects rank ordering', () => {
    expect(isOnTargetTrial({ support: 'semantic_cue' }, 1)).toBe(true);
    expect(isOnTargetTrial({ support: 'recognition_only' }, 2)).toBe(false);
    expect(isOnTargetTrial({ support: 'independent' }, 4)).toBe(true);
    expect(isOnTargetTrial({ support: 'phonemic_cue' }, 4)).toBe(false);
  });
});

describe('photoNamingLevels — progress delta', () => {
  it('on-target trials earn more than below-target trials', () => {
    const trials = Array.from({ length: 5 }, () => trial(true, 'semantic_cue'));
    const onTargetDelta = calculateLevelAwareProgressDelta(trials, 2); // semantic_cue is target
    const belowTargetDelta = calculateLevelAwareProgressDelta(trials, 4); // semantic_cue is below independent
    expect(onTargetDelta).toBeGreaterThan(belowTargetDelta);
    expect(belowTargetDelta).toBeGreaterThan(0);
  });

  it('Level 1 chip-recovery session moves the bar measurably', () => {
    // Six successful chip-recovery taps after production attempts are
    // mapped upstream to semantic_cue. At Level 1 they're on-target.
    const trials = Array.from({ length: 6 }, () => trial(true, 'semantic_cue'));
    const delta = calculateLevelAwareProgressDelta(trials, 1);
    // Should be > 1 progress point — not the ~1%-per-session of the old
    // generic engine that made early rehab feel broken.
    expect(delta).toBeGreaterThan(1);
  });

  it('all 8 level specs are defined', () => {
    for (let i = 1; i <= 8; i++) {
      const s = getPhotoNamingLevelSpec(i);
      expect(s.level).toBe(i);
      expect(s.minOnTargetAttempts).toBeGreaterThan(0);
      expect(s.minOnTargetAccuracy).toBeGreaterThan(0);
    }
  });
});
