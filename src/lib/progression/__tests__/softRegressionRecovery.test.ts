/**
 * PR2 — Soft-regression recovery test.
 *
 * Confirms the support_baseline lifecycle:
 *   - struggle sessions bump it up (capped at +3),
 *   - subsequent success sessions decay it back to 0,
 *   - current_level never drops in v1 (soft-only).
 *
 * This is the "user had a bad week, then bounced back" path.
 */
import { describe, it, expect } from 'vitest';
import {
  defaultProgressionState,
  applySessionToState,
} from '../clinicalProgression';

const ids = { userId: 'u', profileId: 'p', exerciseSlug: 'photo-naming' };
const struggle = () => ({
  trials: Array.from({ length: 10 }, () => ({
    correct: false as const, support: 'independent' as const,
  })),
  evidenceMet: false,
});
const success = () => ({
  trials: Array.from({ length: 10 }, () => ({
    correct: true as const, support: 'independent' as const,
  })),
  evidenceMet: false,
});

describe('soft regression — recovery (PR2)', () => {
  it('bad-week → good-week sequence returns support_baseline to 0', () => {
    let s = defaultProgressionState(ids);
    s = { ...s, currentLevel: 4, stableLevel: 4 };

    // 3 bad sessions — should max support_baseline at +3
    s = applySessionToState(s, struggle());
    s = applySessionToState(s, struggle());
    s = applySessionToState(s, struggle());
    expect(s.supportBaseline).toBe(3);
    expect(s.consecutiveStruggleSessions).toBe(3);
    expect(s.currentLevel).toBe(4); // never drops in v1

    // 3 good sessions — decays to 0
    s = applySessionToState(s, success());
    expect(s.supportBaseline).toBe(2);
    s = applySessionToState(s, success());
    expect(s.supportBaseline).toBe(1);
    s = applySessionToState(s, success());
    expect(s.supportBaseline).toBe(0);
    expect(s.consecutiveSuccessSessions).toBe(3);
    expect(s.consecutiveStruggleSessions).toBe(0);
    expect(s.currentLevel).toBe(4);
  });

  it('support_baseline is clamped — extra struggle sessions never exceed 3', () => {
    let s = defaultProgressionState(ids);
    for (let i = 0; i < 25; i++) s = applySessionToState(s, struggle());
    expect(s.supportBaseline).toBe(3);
  });

  it('an empty session leaves support_baseline unchanged (no decay, no bump)', () => {
    let s = defaultProgressionState(ids);
    s = applySessionToState(s, struggle());
    const baseline = s.supportBaseline;
    s = applySessionToState(s, { trials: [], evidenceMet: false });
    expect(s.supportBaseline).toBe(baseline);
  });
});
