import { describe, it, expect } from 'vitest';
import {
  defaultProgressionState,
  clampLevel,
  clampProgress,
  trialCredit,
  isStruggleTrial,
  calculateProgressDelta,
  applySessionToState,
  MIN_LEVEL,
  MAX_LEVEL,
  MAX_PROGRESS,
} from '../clinicalProgression';

const ids = {
  userId: 'u1',
  profileId: 'p1',
  exerciseSlug: 'photo-naming',
};

describe('clinicalProgression — defaults & clamps', () => {
  it('new user starts at Level 1, 0% progress', () => {
    const s = defaultProgressionState(ids);
    expect(s.currentLevel).toBe(1);
    expect(s.progressPct).toBe(0);
    expect(s.stableLevel).toBe(1);
    expect(s.supportBaseline).toBe(0);
  });

  it('clamps level to [1, 8]', () => {
    expect(clampLevel(0)).toBe(MIN_LEVEL);
    expect(clampLevel(-5)).toBe(MIN_LEVEL);
    expect(clampLevel(99)).toBe(MAX_LEVEL);
    expect(clampLevel(NaN)).toBe(MIN_LEVEL);
  });

  it('clamps progress to [0, 100]', () => {
    expect(clampProgress(-1)).toBe(0);
    expect(clampProgress(150)).toBe(100);
    expect(clampProgress(NaN)).toBe(0);
  });
});

describe('clinicalProgression — credit & struggle', () => {
  it('independent correct gives full credit', () => {
    expect(trialCredit({ correct: true, support: 'independent' })).toBe(1.0);
  });

  it('cued/scaffolded correct gives less credit than independent', () => {
    const indep = trialCredit({ correct: true, support: 'independent' });
    const semantic = trialCredit({ correct: true, support: 'semantic_cue' });
    const phonemic = trialCredit({ correct: true, support: 'phonemic_cue' });
    const recognition = trialCredit({ correct: true, support: 'recognition_only' });
    expect(semantic).toBeLessThan(indep);
    expect(phonemic).toBeLessThan(semantic);
    expect(recognition).toBe(0);
  });

  it('incorrect trial gives zero credit and counts as struggle', () => {
    expect(trialCredit({ correct: false, support: 'independent' })).toBe(0);
    expect(isStruggleTrial({ correct: false, support: 'independent' })).toBe(true);
  });

  it('heavy-support correct counts as struggle', () => {
    expect(isStruggleTrial({ correct: true, support: 'recognition_only' })).toBe(true);
    expect(isStruggleTrial({ correct: true, support: 'after_multiple_replays' })).toBe(true);
  });
});

describe('clinicalProgression — session rollup', () => {
  it('progress persists across sessions', () => {
    let s = defaultProgressionState(ids);
    s = applySessionToState(s, {
      trials: Array.from({ length: 10 }, () => ({
        correct: true as const,
        support: 'independent' as const,
      })),
      evidenceMet: false,
    });
    expect(s.progressPct).toBeGreaterThan(0);
    const afterFirst = s.progressPct;

    s = applySessionToState(s, {
      trials: [{ correct: true, support: 'independent' }],
      evidenceMet: false,
    });
    expect(s.progressPct).toBeGreaterThan(afterFirst);
  });

  it('progress clamps at 100 when evidence not met (holds at top of level)', () => {
    let s = defaultProgressionState(ids);
    s = applySessionToState(s, {
      trials: Array.from({ length: 10000 }, () => ({
        correct: true as const,
        support: 'independent' as const,
      })),
      evidenceMet: false,
    });
    expect(s.progressPct).toBe(MAX_PROGRESS);
    expect(s.currentLevel).toBe(1);
  });

  it('level increments when progress fills AND evidence met', () => {
    let s = defaultProgressionState(ids);
    s = applySessionToState(s, {
      trials: Array.from({ length: 10000 }, () => ({
        correct: true as const,
        support: 'independent' as const,
      })),
      evidenceMet: true,
    });
    expect(s.currentLevel).toBe(2);
    expect(s.progressPct).toBe(0);
  });

  it('struggles increase struggle counter (no level drop in v1 step 1)', () => {
    let s = defaultProgressionState(ids);
    s = { ...s, currentLevel: 4, stableLevel: 4 };
    s = applySessionToState(s, {
      trials: Array.from({ length: 10 }, () => ({
        correct: false as const,
        support: 'independent' as const,
      })),
      evidenceMet: false,
    });
    expect(s.consecutiveStruggleSessions).toBe(1);
    expect(s.supportBaseline).toBeGreaterThan(0);
    expect(s.currentLevel).toBe(4); // never drops here
    expect(s.currentLevel).toBeGreaterThanOrEqual(MIN_LEVEL);
    expect(s.currentLevel).toBeLessThanOrEqual(MAX_LEVEL);
  });

  it('current_level never drops below 1 or above 8 across many sessions', () => {
    let s = defaultProgressionState(ids);
    for (let i = 0; i < 50; i++) {
      s = applySessionToState(s, {
        trials: Array.from({ length: 100 }, () => ({
          correct: true as const,
          support: 'independent' as const,
        })),
        evidenceMet: true,
      });
      expect(s.currentLevel).toBeGreaterThanOrEqual(MIN_LEVEL);
      expect(s.currentLevel).toBeLessThanOrEqual(MAX_LEVEL);
    }
    expect(s.currentLevel).toBe(MAX_LEVEL);
  });

  it('cued-only session yields less progress than independent session', () => {
    const indepDelta = calculateProgressDelta(
      Array.from({ length: 10 }, () => ({ correct: true, support: 'independent' as const }))
    );
    const cuedDelta = calculateProgressDelta(
      Array.from({ length: 10 }, () => ({ correct: true, support: 'phonemic_cue' as const }))
    );
    expect(cuedDelta).toBeLessThan(indepDelta);
  });
});

describe('clinicalProgression — support_baseline hygiene', () => {
  const struggleSession = () => ({
    trials: Array.from({ length: 10 }, () => ({
      correct: false as const,
      support: 'independent' as const,
    })),
    evidenceMet: false,
  });
  const successSession = () => ({
    trials: Array.from({ length: 10 }, () => ({
      correct: true as const,
      support: 'independent' as const,
    })),
    evidenceMet: false,
  });

  it('struggle bumps support_baseline up to max 3', () => {
    let s = defaultProgressionState(ids);
    for (let i = 0; i < 10; i++) s = applySessionToState(s, struggleSession());
    expect(s.supportBaseline).toBe(3);
  });

  it('non-struggle session decays support_baseline by 1', () => {
    let s = defaultProgressionState(ids);
    s = applySessionToState(s, struggleSession());
    s = applySessionToState(s, struggleSession());
    expect(s.supportBaseline).toBe(2);
    s = applySessionToState(s, successSession());
    expect(s.supportBaseline).toBe(1);
    s = applySessionToState(s, successSession());
    expect(s.supportBaseline).toBe(0);
  });

  it('support_baseline never drops below 0', () => {
    let s = defaultProgressionState(ids);
    for (let i = 0; i < 10; i++) s = applySessionToState(s, successSession());
    expect(s.supportBaseline).toBe(0);
  });

  it('support_baseline never exceeds 3', () => {
    let s = defaultProgressionState(ids);
    for (let i = 0; i < 50; i++) s = applySessionToState(s, struggleSession());
    expect(s.supportBaseline).toBeLessThanOrEqual(3);
    expect(s.supportBaseline).toBe(3);
  });
});
