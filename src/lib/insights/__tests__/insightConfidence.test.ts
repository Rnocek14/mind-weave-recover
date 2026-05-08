/**
 * PR-B3 — Centralized confidence helper tests.
 *
 * Locks the contract:
 *  - Trials floor enforces 'insufficient'.
 *  - High / medium / low tiers gated by consistency × effectSize.
 *  - Longitudinal scope (sessionsObserved ≥ N) relaxes the trials floor.
 *  - Provenance is always echoed for internal audit.
 */

import { describe, it, expect } from 'vitest';
import { insightConfidence, INSIGHT_CONFIDENCE_DEFAULTS } from '../insightConfidence';

describe('insightConfidence — tiers', () => {
  it('returns insufficient below the trials floor', () => {
    const v = insightConfidence({
      trialsAtDimension: 5,
      effectSize: 0.9,
      consistencyAcrossTrials: 0.95,
    });
    expect(v.tier).toBe('insufficient');
    expect(v.reason).toMatch(/below_trials_floor/);
  });

  it('returns high when both bars met', () => {
    const v = insightConfidence({
      trialsAtDimension: 12,
      effectSize: 0.5,
      consistencyAcrossTrials: 0.9,
    });
    expect(v.tier).toBe('high');
  });

  it('returns medium when only the medium bar is met', () => {
    const v = insightConfidence({
      trialsAtDimension: 12,
      effectSize: 0.3,
      consistencyAcrossTrials: 0.75,
    });
    expect(v.tier).toBe('medium');
  });

  it('returns low when above floor but below medium bar', () => {
    const v = insightConfidence({
      trialsAtDimension: 12,
      effectSize: 0.1,
      consistencyAcrossTrials: 0.5,
    });
    expect(v.tier).toBe('low');
  });
});

describe('insightConfidence — longitudinal relaxation', () => {
  it('relaxes the trials floor when sessionsObserved meets threshold', () => {
    const factors = {
      trialsAtDimension: Math.ceil(INSIGHT_CONFIDENCE_DEFAULTS.trialsFloor / 2),
      effectSize: 0.5,
      consistencyAcrossTrials: 0.9,
      sessionsObserved: INSIGHT_CONFIDENCE_DEFAULTS.longitudinalRelaxAt,
    };
    expect(insightConfidence(factors).tier).toBe('high');
  });

  it('does NOT relax when sessionsObserved is below threshold', () => {
    const factors = {
      trialsAtDimension: Math.ceil(INSIGHT_CONFIDENCE_DEFAULTS.trialsFloor / 2),
      effectSize: 0.5,
      consistencyAcrossTrials: 0.9,
      sessionsObserved: 1,
    };
    expect(insightConfidence(factors).tier).toBe('insufficient');
  });
});

describe('insightConfidence — provenance', () => {
  it('echoes factors and includes a numeric score', () => {
    const factors = {
      trialsAtDimension: 14,
      effectSize: 0.42,
      consistencyAcrossTrials: 0.88,
    };
    const v = insightConfidence(factors);
    expect(v.factors).toEqual(factors);
    expect(typeof v.score).toBe('number');
    expect(v.score).toBeGreaterThan(0);
    expect(v.score).toBeLessThanOrEqual(1);
  });
});
