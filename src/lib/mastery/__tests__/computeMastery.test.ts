import { describe, it, expect } from 'vitest';
import { computeMastery, suggestLevelChange, type MasteryTrial } from '../computeMastery';

const now = new Date('2026-05-06T12:00:00Z');

function trial(daysBack: number, correct: boolean, cue = 0, sessionId = 's1'): MasteryTrial {
  const d = new Date(now.getTime() - daysBack * 86400_000);
  return {
    is_correct: correct,
    cue_level: cue,
    created_at: d.toISOString(),
    session_id: sessionId,
  };
}

describe('computeMastery', () => {
  it('returns empty for no trials', () => {
    const r = computeMastery([], null, now);
    expect(r.confidence).toBe('none');
    expect(r.trials_total).toBe(0);
  });

  it('low confidence under 12 trials', () => {
    const trials = Array.from({ length: 6 }, (_, i) => trial(i, true, 0, `s${i}`));
    const r = computeMastery(trials, null, now);
    expect(r.confidence).toBe('low');
    expect(r.mastery_score).toBeGreaterThan(0);
  });

  it('rewards unaided correct answers more than cued', () => {
    const unaided = computeMastery(
      Array.from({ length: 15 }, (_, i) => trial(i % 5, true, 0, `s${i % 4}`)),
      null,
      now,
    );
    const cued = computeMastery(
      Array.from({ length: 15 }, (_, i) => trial(i % 5, true, 3, `s${i % 4}`)),
      null,
      now,
    );
    expect(unaided.mastery_score).toBeGreaterThan(cued.mastery_score);
    expect(unaided.cue_independence).toBeGreaterThan(cued.cue_independence ?? 0);
  });

  it('suggests up when mastered + independent', () => {
    const r = {
      mastery_score: 0.85,
      confidence: 'high' as const,
      trials_total: 30, trials_recent: 20,
      accuracy_recent: 0.9, cue_independence: 0.8,
      velocity_per_week: 0.02, plateau_flag: false,
      fatigue_adjusted_score: 0.85, last_practiced_at: now.toISOString(),
      support_dependency_trend: 'stable' as const,
    };
    expect(suggestLevelChange(r, 10)).toBe('up');
  });

  it('holds when not enough trials at level', () => {
    const r = {
      mastery_score: 0.9, confidence: 'high' as const,
      trials_total: 30, trials_recent: 20, accuracy_recent: 1,
      cue_independence: 1, velocity_per_week: 0.1, plateau_flag: false,
      fatigue_adjusted_score: 0.9, last_practiced_at: now.toISOString(),
      support_dependency_trend: null,
    };
    expect(suggestLevelChange(r, 5)).toBe('hold');
  });
});
