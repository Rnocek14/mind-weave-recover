import { describe, expect, it } from 'vitest';
import {
  getThoughtTrainingPrompts,
  getThoughtTrainingStage,
  selectThoughtTrainingPrompt,
} from './trainingStages';

describe('Thought Continuation executable practice stages', () => {
  it('has three genuinely distinct patient-facing prompt formats', () => {
    const s1 = getThoughtTrainingStage(1);
    const s2 = getThoughtTrainingStage(2);
    const s3 = getThoughtTrainingStage(3);
    expect(s1?.label).toContain('familiar sentence');
    expect(s2?.label).toContain('what happens next');
    expect(s3?.label).toContain('two ideas');

    const a = getThoughtTrainingPrompts(1);
    const b = getThoughtTrainingPrompts(2);
    const c = getThoughtTrainingPrompts(3);
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(b.length).toBeGreaterThanOrEqual(8);
    expect(c.length).toBeGreaterThanOrEqual(8);
    expect(a.every(x => x.promptText.trimEnd().endsWith('...'))).toBe(true);
    expect(b.every(x => x.promptText.trimEnd().endsWith('...'))).toBe(true);
    expect(c.every(x => x.promptText.endsWith('?') && x.promptText.includes('. '))).toBe(true);
    expect(new Set([...a, ...b, ...c].map(x => x.id)).size).toBe(a.length + b.length + c.length);
  });

  it.each([1, 2, 3] as const)('keeps every Stage %i prompt in its own exact tier', (level) => {
    const bank = getThoughtTrainingPrompts(level);
    expect(bank.every(prompt => prompt.difficultyTier === level)).toBe(true);
    expect(bank.every(prompt =>
      prompt.isActive && prompt.narrowingSteps.length === 2 &&
      prompt.narrowingSteps.every(step => step.text.trim().length > 6)
    )).toBe(true);

    let used: string[] = [];
    for (let i = 0; i < bank.length; i++) {
      const next = selectThoughtTrainingPrompt(level, used);
      expect(next).not.toBeNull();
      expect(next?.difficultyTier).toBe(level);
      expect(used).not.toContain(next?.id);
      used = [...used, next!.id];
    }
    // No silent tier-blending or reusing a completed prompt.
    expect(selectThoughtTrainingPrompt(level, used)).toBeNull();
  });

  it('does not fabricate an L4-L8 runtime stage or silently clamp a saved level', () => {
    for (const value of [null, undefined, 0, -1, 4, 5, 6, 7, 8, 9, NaN, 1.5]) {
      expect(getThoughtTrainingStage(value)).toBeNull();
    }
    expect(getThoughtTrainingStage(1)?.level).toBe(1);
    expect(getThoughtTrainingStage(3)?.level).toBe(3);
  });

  it('keeps support as optional hints, not a level or a fabricated answer key', () => {
    for (const level of [1, 2, 3] as const) {
      for (const prompt of getThoughtTrainingPrompts(level)) {
        expect(prompt.narrowingSteps.map(hint => hint.level)).toEqual([1, 2]);
        expect(prompt.narrowingSteps.every(hint => hint.text !== prompt.promptText)).toBe(true);
      }
    }
  });
});
