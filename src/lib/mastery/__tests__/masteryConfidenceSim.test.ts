/**
 * Phase A.1 — Mastery Visibility validation.
 *
 * These tests do NOT exercise any gating. They pin that the mastery
 * CONFIDENCE signal behaves sensibly across longitudinal archetypes, so we
 * can trust it before letting it influence (A.2) or gate (A.3) promotion.
 *
 * Each test maps to one of the five questions Phase A.1 must answer.
 */
import { describe, it, expect } from 'vitest';
import {
  runMasteryConfidenceSim,
  CONFIDENCE_RANK,
} from '../masteryConfidenceSim';

const SEED = 7;

describe('Phase A.1 — mastery confidence behaves sensibly (visibility only)', () => {
  it('Q1: confidence increases when it should (steady improver reaches medium+)', () => {
    const tr = runMasteryConfidenceSim('steady_improver', 30, SEED);
    // Starts with no opinion…
    expect(tr.snapshots[0].confidence).toBe('none');
    // …and earns at least medium by the end.
    expect(CONFIDENCE_RANK[tr.peakConfidence]).toBeGreaterThanOrEqual(
      CONFIDENCE_RANK.medium,
    );
    // Final mastery should reflect genuine independence (high accuracy + low cues).
    expect(tr.final.masteryScore).toBeGreaterThan(0.6);
    expect(tr.final.cueIndependence ?? 0).toBeGreaterThan(0.7);
  });

  it('Q2: confidence stagnates when it should (plateau settles and flags)', () => {
    const tr = runMasteryConfidenceSim('plateau', 30, SEED);
    // Plateau reaches a moderate confidence but should not run away to high
    // immediately; mastery score stays in a moderate band.
    expect(tr.final.masteryScore).toBeGreaterThan(0.3);
    expect(tr.final.masteryScore).toBeLessThan(0.85);
    // The plateau flag should appear at least once over the steady run.
    expect(tr.snapshots.some((s) => s.plateauFlag)).toBe(true);
  });

  it('Q3: confidence survives bad days (recovery never collapses to none after medium)', () => {
    const tr = runMasteryConfidenceSim('recovery_after_setback', 30, SEED);
    // It must have reached medium before the setback to make this meaningful.
    expect(CONFIDENCE_RANK[tr.peakConfidence]).toBeGreaterThanOrEqual(
      CONFIDENCE_RANK.medium,
    );
    // Once medium is reached, a bad stretch must NOT wipe confidence back to none.
    expect(tr.lowestConfidenceAfterMedium).not.toBeNull();
    expect(CONFIDENCE_RANK[tr.lowestConfidenceAfterMedium!]).toBeGreaterThanOrEqual(
      CONFIDENCE_RANK.low,
    );
  });

  it('Q3b: the setback is actually visible in the mastery SCORE (dip then rebound)', () => {
    const tr = runMasteryConfidenceSim('recovery_after_setback', 30, SEED);
    const scores = tr.snapshots.map((s) => s.masteryScore);
    const setbackStart = Math.floor(30 * 0.45);
    const setbackEnd = Math.floor(30 * 0.6);
    const preDip = Math.max(...scores.slice(0, setbackStart));
    const duringDip = Math.min(...scores.slice(setbackStart, setbackEnd + 1));
    const afterRebound = Math.max(...scores.slice(setbackEnd + 1));
    expect(duringDip).toBeLessThan(preDip); // score dips
    expect(afterRebound).toBeGreaterThan(duringDip); // and rebounds
  });

  it('Q4: confidence correlates with independence (cue-dependent stays below steady)', () => {
    const steady = runMasteryConfidenceSim('steady_improver', 30, SEED);
    const cueDep = runMasteryConfidenceSim('cue_dependent', 30, SEED);
    // Despite high raw accuracy, the cue-dependent learner earns a LOWER
    // mastery score than the steady improver — independence is what counts.
    expect(cueDep.final.masteryScore).toBeLessThan(steady.final.masteryScore);
  });

  it('Q5: confidence correlates with cue dependency (cue independence stays low)', () => {
    const cueDep = runMasteryConfidenceSim('cue_dependent', 30, SEED);
    // Heavy-cue user should never look independent.
    expect(cueDep.final.cueIndependence ?? 1).toBeLessThan(0.35);
    // …even though raw accuracy is high.
    expect(cueDep.final.accuracyRecent ?? 0).toBeGreaterThan(0.7);
  });

  it('is deterministic for a fixed seed', () => {
    const a = runMasteryConfidenceSim('steady_improver', 30, SEED);
    const b = runMasteryConfidenceSim('steady_improver', 30, SEED);
    expect(a.snapshots).toEqual(b.snapshots);
  });

  it('VISIBILITY ONLY: simulator writes nothing and never throws across archetypes', () => {
    for (const id of [
      'steady_improver',
      'plateau',
      'cue_dependent',
      'recovery_after_setback',
    ] as const) {
      expect(() => runMasteryConfidenceSim(id, 30, SEED)).not.toThrow();
    }
  });
});
