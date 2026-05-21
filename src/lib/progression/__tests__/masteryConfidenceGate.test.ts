/**
 * PR2 — Mastery-confidence gate test (focused).
 *
 * Existing `clinicalProgression.test.ts` covers the four confidence
 * branches inline. This file pins the *contract* in isolation so the
 * gate cannot regress silently:
 *
 *   gate(undefined) = open   (backward compat — no rows yet)
 *   gate('none')    = closed
 *   gate('low')     = closed
 *   gate('medium')  = open
 *   gate('high')    = open
 *
 * And re-verifies the end-to-end effect through `applySessionToState`.
 */
import { describe, it, expect } from 'vitest';
import {
  applySessionToState,
  defaultProgressionState,
  masteryConfidenceMeetsGate,
  MAX_PROGRESS,
} from '../clinicalProgression';

const ids = { userId: 'u', profileId: 'p', exerciseSlug: 'photo-naming' };
const fillTrials = () =>
  Array.from({ length: 10000 }, () => ({
    correct: true as const, support: 'independent' as const,
  }));

describe('mastery-confidence gate — contract (PR2)', () => {
  it('pure gate function: medium/high open, low/none closed, undefined open', () => {
    expect(masteryConfidenceMeetsGate(undefined)).toBe(true);
    expect(masteryConfidenceMeetsGate('none')).toBe(false);
    expect(masteryConfidenceMeetsGate('low')).toBe(false);
    expect(masteryConfidenceMeetsGate('medium')).toBe(true);
    expect(masteryConfidenceMeetsGate('high')).toBe(true);
  });

  it.each(['none', 'low'] as const)(
    'applySessionToState with masteryConfidence=%s holds at top of level',
    (conf) => {
      const s = applySessionToState(defaultProgressionState(ids), {
        trials: fillTrials(),
        evidenceMet: true,
        masteryConfidence: conf,
      });
      expect(s.currentLevel).toBe(1);
      expect(s.progressPct).toBe(MAX_PROGRESS);
    },
  );

  it.each(['medium', 'high'] as const)(
    'applySessionToState with masteryConfidence=%s allows level-up',
    (conf) => {
      const s = applySessionToState(defaultProgressionState(ids), {
        trials: fillTrials(),
        evidenceMet: true,
        masteryConfidence: conf,
      });
      expect(s.currentLevel).toBe(2);
      expect(s.progressPct).toBe(0);
    },
  );

  it('evidenceMet=false blocks level-up regardless of mastery confidence', () => {
    const s = applySessionToState(defaultProgressionState(ids), {
      trials: fillTrials(),
      evidenceMet: false,
      masteryConfidence: 'high',
    });
    expect(s.currentLevel).toBe(1);
    expect(s.progressPct).toBe(MAX_PROGRESS);
  });
});
