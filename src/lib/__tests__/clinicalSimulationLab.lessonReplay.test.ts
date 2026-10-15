/**
 * Clinical Simulation Lab: 30-day REAL lesson planner replay.
 *
 * No network, no DB writes, no real patient data. Tests prioritization from
 * production planning signals to production daily lesson selection.
 */
import { describe, expect, it } from 'vitest';
import { generateDailyLesson, type PerformanceSignals } from '@/lib/dailyLessonEngine';
import { buildProgressionPlanningSignals, type ProgressionRow } from '@/lib/progressionPlanningSignals';
import { POLISHED_EXERCISES } from '@/lib/polishedExercises';

const performance: PerformanceSignals = {
  avgReactionTime: 2000,
  avgAccuracy: 0.75,
  timeoutRate: 0.05,
  errorTypes: { semantic: 0.1, phonological: 0.1, omissions: 0, perseverations: 0 },
  frustrationLevel: 'low',
  fatigueLevel: 'low',
  engagementScore: 8,
};

function state(exercise_slug: string, struggling: boolean): ProgressionRow {
  return {
    exercise_slug,
    current_level: struggling ? 2 : 5,
    progress_pct: struggling ? 20 : 70,
    support_baseline: struggling ? 2 : 0,
    stable_level: struggling ? 2 : 5,
    consecutive_success_sessions: struggling ? 0 : 4,
    consecutive_struggle_sessions: struggling ? 3 : 0,
  };
}

function lesson(strugglingGame: string) {
  const rows = ['photo-naming', 'category-fluency', 'minimal-pairs'].map(
    slug => state(slug, slug === strugglingGame),
  );
  const { byExercise } = buildProgressionPlanningSignals(rows);
  return generateDailyLesson(
    { vision: 8, motor: 8, attention: 8, confidence: 0.8 },
    null,
    [...POLISHED_EXERCISES],
    performance,
    [],
    'independent',
    null, null, null, null, null, null, null, null,
    byExercise,
  );
}

describe('Clinical Simulation Lab: 30-day lesson planner replay', () => {
  it('produces valid lesson blocks across 30 synthetic days', () => {
    for (let day = 1; day <= 30; day++) {
      const focus = day <= 10 ? 'photo-naming' : day <= 20 ? 'minimal-pairs' : 'category-fluency';
      const result = lesson(focus);
      expect(result.blocks.length).toBeGreaterThan(0);
      for (const block of result.blocks) {
        expect(POLISHED_EXERCISES).toContain(block.exerciseId);
        expect(block.duration).toBeGreaterThan(0);
        expect(block.adaptations.startDifficulty).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('responds to opposite longitudinal weakness profiles', () => {
    const photoWeak = lesson('photo-naming').blocks.map(b => b.exerciseId);
    const minimalWeak = lesson('minimal-pairs').blocks.map(b => b.exerciseId);
    expect(photoWeak.join(',')).not.toBe(minimalWeak.join(','));
    const idx = (arr: string[], slug: string) => {
      const i = arr.indexOf(slug);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    expect(idx(photoWeak, 'photo-naming')).toBeLessThan(idx(minimalWeak, 'photo-naming'));
  });
});
