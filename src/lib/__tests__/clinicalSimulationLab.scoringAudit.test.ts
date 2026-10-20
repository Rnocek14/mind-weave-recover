/**
 * Clinical Simulation Lab: performance scoring truthfulness checks.
 *
 * Characterization assertions deliberately document unsafe or surprising
 * current behavior. They must not be interpreted as acceptable clinical
 * scoring rules. Use them to review a fix before changing production code.
 */
import { describe, expect, it } from 'vitest';
import { aggregatePerformanceSignals } from '@/lib/dailyLessonEngine';

const trial = (score: number | null, reaction_time_ms: number | null = 1200) => ({
  score, reaction_time_ms, error_type: null, engagement_flags: null,
});

describe('Clinical Simulation Lab: performance aggregation audit', () => {
  it('recognizes binary 1.0 as correct in existing scoring', () => {
    const result = aggregatePerformanceSignals([trial(1), trial(0)], []);
    expect(result.avgAccuracy).toBe(0.5);
  });

  it('CHARACTERIZATION: existing scoring does not recognize 100-point correct scores', () => {
    const result = aggregatePerformanceSignals([trial(100), trial(0)], []);
    // Known scale-mismatch risk: a 100/100 result counts as incorrect.
    // Replace this assertion with normalized-scoring expectations once the
    // event schema has a canonical per-game scoring contract.
    expect(result.avgAccuracy).toBe(0);
  });

  it('CHARACTERIZATION: missing scores still affect the accuracy denominator', () => {
    const result = aggregatePerformanceSignals([trial(1), trial(null)], []);
    expect(result.avgAccuracy).toBe(0.5);
  });

  it('CHARACTERIZATION: null reaction time is currently counted as a timeout', () => {
    const result = aggregatePerformanceSignals([trial(1, null)], []);
    expect(result.timeoutRate).toBe(1);
  });
});
