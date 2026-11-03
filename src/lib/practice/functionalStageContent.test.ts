import { describe, expect, it } from 'vitest';
import {
  evaluateFunctionalPracticeTrial,
  FUNCTIONAL_PRACTICE_STAGES,
  getFunctionalPracticeStage,
  getFunctionalPracticeTrials,
  type FunctionalPracticeKind,
} from './functionalStageContent';

const KINDS: FunctionalPracticeKind[] = ['word-finding', 'sentence-game'];

describe('eight real, practice-only functional language formats', () => {
  it.each(KINDS)('%s has eight distinct stages and three uniquely identified actual tasks per stage', kind => {
    const stages = FUNCTIONAL_PRACTICE_STAGES[kind];
    expect(stages.map(stage => stage.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(stages.map(stage => stage.title)).size).toBe(8);
    const allIds = new Set<string>();
    for (const stage of stages) {
      expect(getFunctionalPracticeStage(kind, stage.level)).toEqual(stage);
      const tasks = getFunctionalPracticeTrials(kind, stage.level);
      expect(tasks).toHaveLength(3);
      for (const task of tasks) {
        expect(allIds.has(task.id), task.id).toBe(false);
        allIds.add(task.id);
        expect(task.prompt.trim()).not.toBe('');
        expect(task.clue.trim()).not.toBe('');
      }
    }
    expect(allIds.size).toBe(24);
    expect(getFunctionalPracticeStage(kind, 0)).toBeNull();
    expect(getFunctionalPracticeStage(kind, 9)).toBeNull();
    expect(getFunctionalPracticeStage(kind, 1.5)).toBeNull();
  });

  it.each(KINDS)('%s upper stages are open communicative practice, never auto-graded', kind => {
    for (const level of [6, 7, 8] as const) {
      for (const trial of getFunctionalPracticeTrials(kind, level)) {
        expect(trial.kind).toBe('open');
        expect(evaluateFunctionalPracticeTrial(trial, { choiceIndex: 0 })).toEqual({
          correct: null, practiceAccuracy: null,
        });
      }
    }
    // No fallback to easier items silently labeled high-stage.
    expect(getFunctionalPracticeTrials(kind, 8).every(item => item.id.includes(
      kind === 'word-finding' ? 'wf-transfer-' : 'sg-novel-',
    ))).toBe(true);
    expect(getFunctionalPracticeTrials(kind, 8, 0)).toEqual([]);
  });

  it('recognizes a real correct/wrong choice and measures actual tile order', () => {
    const choice = getFunctionalPracticeTrials('word-finding', 1)[0];
    expect(choice.kind).toBe('choice');
    expect(evaluateFunctionalPracticeTrial(choice, { choiceIndex: 0 })).toEqual({
      correct: true, practiceAccuracy: 1,
    });
    expect(evaluateFunctionalPracticeTrial(choice, { choiceIndex: 1 })).toEqual({
      correct: false, practiceAccuracy: 0,
    });

    const ordered = getFunctionalPracticeTrials('sentence-game', 3)[0];
    expect(ordered.kind).toBe('order');
    if (ordered.kind !== 'order') return;
    expect(evaluateFunctionalPracticeTrial(ordered, { order: [...ordered.ordered] })).toEqual({
      correct: true, practiceAccuracy: 1,
    });
    expect(evaluateFunctionalPracticeTrial(ordered, {
      order: [ordered.ordered[2], ordered.ordered[0], ordered.ordered[1]],
    })).toEqual({ correct: false, practiceAccuracy: 0 });
    expect(evaluateFunctionalPracticeTrial(ordered, { order: [] })).toEqual({
      correct: false, practiceAccuracy: 0,
    });
  });
});
