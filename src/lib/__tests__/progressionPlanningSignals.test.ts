/**
 * QA: Progression → planning feedback (#4).
 *
 * Guards that per-game longitudinal progression actually changes daily lesson
 * planning. If a patient who is strong on Photo Naming but weak on Fix Sentence
 * produced the SAME plan as the mirror-image patient, the progression layer
 * would be cosmetic. These tests assert the pure signal transform classifies
 * states correctly AND that opposite progression profiles diverge in plans.
 */

import { describe, it, expect } from 'vitest';
import {
  buildProgressionPlanningSignals,
  type ProgressionRow,
} from '@/lib/progressionPlanningSignals';
import {
  generateDailyLesson,
  type PerformanceSignals,
} from '@/lib/dailyLessonEngine';
import { POLISHED_EXERCISES } from '@/lib/polishedExercises';

const NEUTRAL_SIGNALS: PerformanceSignals = {
  avgReactionTime: 2000,
  avgAccuracy: 0.7,
  timeoutRate: 0.1,
  errorTypes: { semantic: 0.1, phonological: 0.1, omissions: 0.1, perseverations: 0.1 },
  frustrationLevel: 'low',
  fatigueLevel: 'low',
  engagementScore: 6,
};

function row(slug: string, overrides: Partial<ProgressionRow>): ProgressionRow {
  return {
    exercise_slug: slug,
    current_level: 1,
    progress_pct: 0,
    support_baseline: 0,
    stable_level: 1,
    consecutive_success_sessions: 0,
    consecutive_struggle_sessions: 0,
    ...overrides,
  };
}

describe('progression planning signals — classification', () => {
  it('flags struggling when consecutive struggle sessions >= 2', () => {
    const { byExercise } = buildProgressionPlanningSignals([
      row('fix-sentence', { current_level: 2, consecutive_struggle_sessions: 2 }),
    ]);
    expect(byExercise.get('fix-sentence')?.status).toBe('struggling');
    expect(byExercise.get('fix-sentence')!.planningBoost).toBeGreaterThan(0);
  });

  it('flags advancing when on a success streak', () => {
    const { byExercise } = buildProgressionPlanningSignals([
      row('photo-naming', { current_level: 7, consecutive_success_sessions: 5 }),
    ]);
    expect(byExercise.get('photo-naming')?.status).toBe('advancing');
    expect(byExercise.get('photo-naming')!.planningBoost).toBeLessThanOrEqual(0);
  });

  it('flags lagging games that trail the lead game by >= 2 levels', () => {
    const { byExercise } = buildProgressionPlanningSignals([
      row('photo-naming', { current_level: 7, consecutive_success_sessions: 1 }),
      row('minimal-pairs', { current_level: 1, consecutive_success_sessions: 1 }),
    ]);
    expect(byExercise.get('minimal-pairs')?.status).toBe('lagging');
  });
});

describe('progression planning signals — plan divergence', () => {
  // Use polished slugs only — the engine filters to the polished allowlist before
  // selection, so non-polished slugs (e.g. fix-sentence) never reach the plan.
  const accessible = [...POLISHED_EXERCISES];

  function planFor(rows: ProgressionRow[]): string[] {
    const { byExercise } = buildProgressionPlanningSignals(rows);
    const lesson = generateDailyLesson(
      { vision: 8, motor: 8, attention: 8, confidence: 0.7 },
      null,
      accessible,
      { ...NEUTRAL_SIGNALS, engagementScore: 8 },
      [],
      'independent',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      byExercise,
    );
    return lesson.blocks.map(b => b.exerciseId);
  }

  it('mirror-image progression profiles produce different prioritization', () => {
    // Patient A: strong photo-naming (advancing), weak category-fluency + minimal-pairs
    const planA = planFor([
      row('photo-naming', { current_level: 7, consecutive_success_sessions: 5 }),
      row('category-fluency', { current_level: 2, consecutive_struggle_sessions: 2 }),
      row('minimal-pairs', { current_level: 1, consecutive_struggle_sessions: 2 }),
    ]);
    // Patient B: strong category-fluency + minimal-pairs, weak photo-naming (struggling)
    const planB = planFor([
      row('photo-naming', { current_level: 2, consecutive_struggle_sessions: 2 }),
      row('category-fluency', { current_level: 7, consecutive_success_sessions: 5 }),
      row('minimal-pairs', { current_level: 7, consecutive_success_sessions: 5 }),
    ]);

    expect(planA.length).toBeGreaterThan(0);
    expect(planB.length).toBeGreaterThan(0);
    // Full ordering must diverge between mirror-image patients.
    expect(planA.join(',')).not.toBe(planB.join(','));
    // Photo-naming is advancing for A (deprioritized) but struggling for B
    // (prioritized) — so it should rank earlier in B than in A.
    const idxA = planA.indexOf('photo-naming');
    const idxB = planB.indexOf('photo-naming');
    const normA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
    const normB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
    expect(normB).toBeLessThan(normA);
  });
});
