/**
 * Phase A.2 — mastery confidence explainability + promotion recommendation.
 *
 * These tests pin the contract that makes A.2 trustworthy:
 *   1. Confidence is EXPLAINABLE (number-bearing reasons), and
 *   2. Mastery influences promotion as a RECOMMENDATION, not a hard gate
 *      (low = delay+reinforce, never a permanent block; no signal = no opinion).
 */
import { describe, it, expect } from 'vitest';
import {
  explainMasteryConfidence,
  MASTERY_THRESHOLDS,
} from '../masteryConfidenceReasons';
import {
  classifyMasteryPromotion,
  tallyMasteryDecisions,
} from '../masteryPromotionDecision';

describe('A.2 — confidence explainability', () => {
  it('explains insufficient volume for a brand-new skill', () => {
    const e = explainMasteryConfidence({
      confidence: 'none',
      trialsTotal: 3,
      sessionCount: 1,
      daySpanDays: 0,
      cueIndependence: null,
      accuracyRecent: null,
      plateauFlag: false,
    });
    expect(e.limitingCode).toBe('insufficient_volume');
    expect(e.summary).toMatch(/3 response/i);
  });

  it('flags high cue dependency with concrete numbers', () => {
    const e = explainMasteryConfidence({
      confidence: 'low',
      trialsTotal: 40,
      sessionCount: 6,
      daySpanDays: 6,
      cueIndependence: 0.2, // 80% of corrects leaned on cues
      accuracyRecent: 0.85,
      plateauFlag: false,
    });
    const cue = e.reasons.find((r) => r.code === 'high_cue_dependency');
    expect(cue).toBeTruthy();
    expect(cue!.detail).toMatch(/80%/);
    expect(e.limitingCode).toBe('high_cue_dependency');
  });

  it('reports strong evidence at high confidence', () => {
    const e = explainMasteryConfidence({
      confidence: 'high',
      trialsTotal: 60,
      sessionCount: 8,
      daySpanDays: 10,
      cueIndependence: 0.9,
      accuracyRecent: 0.92,
      plateauFlag: false,
    });
    expect(e.limitingCode).toBeNull();
    expect(e.reasons.some((r) => r.code === 'strong_independent_evidence')).toBe(true);
    expect(e.summary).toMatch(/high confidence/i);
  });

  it('medium held back by sessions/timespan is non-limiting (just not high yet)', () => {
    const e = explainMasteryConfidence({
      confidence: 'medium',
      trialsTotal: 14,
      sessionCount: 3,
      daySpanDays: 1,
      cueIndependence: 0.8,
      accuracyRecent: 0.85,
      plateauFlag: false,
    });
    // No clinical weakness limiting it — just not enough sessions/time for high.
    expect(e.limitingCode).toBeNull();
    expect(e.reasons.some((r) => r.code === 'insufficient_timespan')).toBe(true);
  });

  it('thresholds are the same numbers computeMastery uses', () => {
    expect(MASTERY_THRESHOLDS.LOW_MIN_TRIALS).toBe(5);
    expect(MASTERY_THRESHOLDS.MEDIUM_MIN_TRIALS).toBe(12);
    expect(MASTERY_THRESHOLDS.HIGH_MIN_TRIALS).toBe(30);
  });
});

describe('A.2 — promotion recommendation (recommendation, not gate)', () => {
  it('verdict pass → promote', () => {
    const r = classifyMasteryPromotion({ verdict: 'pass' });
    expect(r.decision).toBe('promote');
    expect(r.reinforcementRecommended).toBe(false);
  });

  it('verdict block → delay + reinforcement + planner boost (not permanent)', () => {
    const r = classifyMasteryPromotion({ verdict: 'block' });
    expect(r.decision).toBe('delay_reinforce');
    expect(r.reinforcementRecommended).toBe(true);
    expect(r.plannerBoost).toBe(true);
  });

  it('verdict skip → no opinion (skip = open, new users never blocked)', () => {
    const r = classifyMasteryPromotion({ verdict: 'skip' });
    expect(r.decision).toBe('no_opinion');
  });

  it('confidence fallback: high/medium promote, low delays, none/undefined defer', () => {
    expect(classifyMasteryPromotion({ confidence: 'high' }).decision).toBe('promote');
    expect(classifyMasteryPromotion({ confidence: 'medium' }).decision).toBe('promote');
    expect(classifyMasteryPromotion({ confidence: 'low' }).decision).toBe('delay_reinforce');
    expect(classifyMasteryPromotion({ confidence: 'none' }).decision).toBe('no_opinion');
    expect(classifyMasteryPromotion({}).decision).toBe('no_opinion');
  });

  it('verdict takes precedence over raw confidence', () => {
    const r = classifyMasteryPromotion({ verdict: 'pass', confidence: 'low' });
    expect(r.decision).toBe('promote');
    expect(r.basis).toBe('verdict');
  });

  it('telemetry tallies approve/delay/no-opinion and delay rate among opinions', () => {
    const t = tallyMasteryDecisions([
      'promote',
      'promote',
      'delay_reinforce',
      'no_opinion',
    ]);
    expect(t.approved).toBe(2);
    expect(t.delayed).toBe(1);
    expect(t.noOpinion).toBe(1);
    expect(t.total).toBe(4);
    expect(t.delayRateAmongOpinions).toBeCloseTo(1 / 3, 5);
  });
});

describe('A.2 (tightened) — promotion requires evidence AND mastery quality', () => {
  it('cue-dependent high accuracy must DELAY (enough data, not independent)', () => {
    const r = classifyMasteryPromotion({
      confidence: 'high',     // plenty of data
      masteryScore: 0.4,
      cueIndependence: 0.2,   // 80% of corrects leaned on cues
    });
    expect(r.decision).toBe('delay_reinforce');
    expect(r.qualityLimiter).toBe('high_cue_dependency');
    expect(r.reason).toMatch(/depend heavily on cues/i);
  });

  it('inconsistent performance must DELAY (independent but mastery too low)', () => {
    const r = classifyMasteryPromotion({
      confidence: 'medium',
      masteryScore: 0.25,     // wobbling well below the floor
      cueIndependence: 0.8,
    });
    expect(r.decision).toBe('delay_reinforce');
    expect(r.qualityLimiter).toBe('low_mastery_score');
  });

  it('fatigue dip must DELAY even with decent independence', () => {
    const r = classifyMasteryPromotion({
      confidence: 'high',
      masteryScore: 0.3,
      cueIndependence: 0.74,
    });
    expect(r.decision).toBe('delay_reinforce');
    expect(r.qualityLimiter).toBe('low_mastery_score');
  });

  it('active plateau/fatigue/regression flags DELAY regardless of scores', () => {
    expect(
      classifyMasteryPromotion({
        confidence: 'high', masteryScore: 0.9, cueIndependence: 0.9, plateauFlag: true,
      }).qualityLimiter,
    ).toBe('plateau');
    expect(
      classifyMasteryPromotion({
        confidence: 'high', masteryScore: 0.9, cueIndependence: 0.9, fatigueFlag: true,
      }).qualityLimiter,
    ).toBe('fatigue');
    expect(
      classifyMasteryPromotion({
        confidence: 'high', masteryScore: 0.9, cueIndependence: 0.9, regressionFlag: true,
      }).qualityLimiter,
    ).toBe('regression');
  });

  it('overachiever PROMOTES (enough data + strong independent mastery)', () => {
    const r = classifyMasteryPromotion({
      confidence: 'high',
      masteryScore: 0.9,
      cueIndependence: 0.95,
    });
    expect(r.decision).toBe('promote');
    expect(r.qualityLimiter).toBeNull();
  });

  it('recovered fatigue user can PROMOTE after rebound', () => {
    const r = classifyMasteryPromotion({
      confidence: 'high',
      masteryScore: 0.85,
      cueIndependence: 0.8,
      fatigueFlag: false,
    });
    expect(r.decision).toBe('promote');
  });

  it('quality gate never produces a permanent block — delays stay reinforceable', () => {
    const r = classifyMasteryPromotion({
      confidence: 'high', masteryScore: 0.4, cueIndependence: 0.2,
    });
    expect(r.decision).toBe('delay_reinforce');
    expect(r.reinforcementRecommended).toBe(true);
    expect(r.plannerBoost).toBe(true);
  });

  it('still defers to evidence with no quality signals (legacy callers unchanged)', () => {
    // No mastery/cue numbers → quality cannot disqualify; evidence governs.
    expect(classifyMasteryPromotion({ confidence: 'high' }).decision).toBe('promote');
    expect(classifyMasteryPromotion({ confidence: 'none' }).decision).toBe('no_opinion');
  });
});
