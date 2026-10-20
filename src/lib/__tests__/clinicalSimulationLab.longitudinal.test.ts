/**
 * Synthetic longitudinal clinical progression replay.
 * Tests the REAL pure production progression transform without any database,
 * patient data, Azure calls or synthetic claims of clinical effectiveness.
 */
import { describe, expect, it } from 'vitest';
import {
  applySessionToState,
  defaultProgressionState,
  type ClinicalProgressionState,
  type SupportLevel,
} from '@/lib/progression/clinicalProgression';
import { buildProgressionPlanningSignals, type ProgressionRow } from '@/lib/progressionPlanningSignals';

type SimSession = {
  day: number;
  correct: number;
  incorrect: number;
  support: SupportLevel;
  evidenceMet?: boolean;
  masteryVerdict?: 'pass' | 'block' | 'skip';
  progressDelta?: number;
};

function replay(sessions: SimSession[], exerciseSlug = 'photo-naming') {
  let state = defaultProgressionState({
    userId: 'synthetic-user',
    profileId: 'synthetic-profile',
    exerciseSlug,
  });
  const trace: Array<{ day: number; before: ClinicalProgressionState; after: ClinicalProgressionState }> = [];
  for (const session of sessions) {
    const before = state;
    state = applySessionToState(state, {
      trials: [
        ...Array.from({ length: session.correct }, () => ({ correct: true, support: session.support })),
        ...Array.from({ length: session.incorrect }, () => ({ correct: false, support: session.support })),
      ],
      evidenceMet: session.evidenceMet ?? false,
      masteryVerdict: session.masteryVerdict,
      progressDelta: session.progressDelta,
      maxImplementedLevel: 3,
    });
    trace.push({ day: session.day, before, after: state });
  }
  return { state, trace };
}

function planningRow(s: ClinicalProgressionState): ProgressionRow {
  return {
    exercise_slug: s.exerciseSlug,
    current_level: s.currentLevel,
    progress_pct: s.progressPct,
    support_baseline: s.supportBaseline,
    stable_level: s.stableLevel,
    consecutive_success_sessions: s.consecutiveSuccessSessions,
    consecutive_struggle_sessions: s.consecutiveStruggleSessions,
  };
}

describe('Clinical Simulation Lab: synthetic longitudinal replay', () => {
  it('holds at a clinical level until valid mastery evidence is present', () => {
    const { trace, state } = replay([
      { day: 1, correct: 8, incorrect: 2, support: 'independent', progressDelta: 100, evidenceMet: false },
      { day: 2, correct: 8, incorrect: 2, support: 'independent', evidenceMet: false },
      { day: 3, correct: 9, incorrect: 1, support: 'independent', evidenceMet: true, masteryVerdict: 'block' },
      { day: 4, correct: 9, incorrect: 1, support: 'independent', evidenceMet: true, masteryVerdict: 'pass' },
    ]);
    expect(trace.slice(0, 3).every(x => x.after.currentLevel === 1)).toBe(true);
    expect(state.currentLevel).toBe(2);
    expect(state.progressPct).toBe(0);
  });

  it('uses support escalation instead of dropping the clinical level after struggles', () => {
    const sessions: SimSession[] = Array.from({ length: 10 }, (_, i) => ({
      day: i + 1, correct: 1, incorrect: 9, support: 'independent',
    }));
    const { state, trace } = replay(sessions);
    expect(state.currentLevel).toBe(1);
    expect(state.supportBaseline).toBe(3);
    expect(state.consecutiveStruggleSessions).toBe(10);
    expect(trace.every(x => x.after.currentLevel === 1)).toBe(true);
    const signal = buildProgressionPlanningSignals([planningRow(state)]).byExercise.get('photo-naming');
    expect(signal?.status).toBe('struggling');
    expect(signal?.planningBoost).toBeGreaterThan(0);
  });

  it('cued correct attempts produce less progress than independent correct attempts', () => {
    const independent = replay([{ day: 1, correct: 10, incorrect: 0, support: 'independent' }]);
    const cued = replay([{ day: 1, correct: 10, incorrect: 0, support: 'phonemic_cue' }]);
    expect(independent.state.progressPct).toBeGreaterThan(cued.state.progressPct);
  });

  it('never advances beyond the actually implemented content ceiling', () => {
    const sessions: SimSession[] = Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      correct: 10,
      incorrect: 0,
      support: 'independent',
      evidenceMet: true,
      masteryVerdict: 'pass',
      progressDelta: 100,
    }));
    const { state, trace } = replay(sessions);
    expect(state.currentLevel).toBe(3);
    expect(trace.every(x => x.after.currentLevel <= 3)).toBe(true);
  });

  it('empty sessions do not independently cause clinical promotion', () => {
    const { state } = replay(Array.from({ length: 30 }, (_, i) => ({
      day: i + 1, correct: 0, incorrect: 0, support: 'independent', evidenceMet: false,
    })));
    expect(state.currentLevel).toBe(1);
    expect(state.progressPct).toBe(0);
  });
});
