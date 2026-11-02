import { describe, expect, it } from 'vitest';
import { getNarrativeTrainingStage, resolveNarrativeTrainingVisualSupport } from '@/lib/narrative/trainingStages';

describe('Narrative Retell executable training stages', () => {
  it('changes both story complexity and delivered help, not just a badge', () => {
    const one = getNarrativeTrainingStage(1)!;
    const two = getNarrativeTrainingStage(2)!;
    const three = getNarrativeTrainingStage(3)!;
    expect([one.storyTier, two.storyTier, three.storyTier]).toEqual([1, 1, 2]);
    expect([one.baselineSupport, two.baselineSupport, three.baselineSupport]).toEqual([3, 2, 1]);
    expect([one.label, two.label, three.label].every(Boolean)).toBe(true);
  });

  it('never mislabels unsupported or unhydrated levels as 1–3', () => {
    for (const value of [null, undefined, 0, 4, 8, NaN, Infinity, -1, 2.5]) {
      expect(getNarrativeTrainingStage(value)).toBeNull();
    }
  });

  it('keeps starter support and only adds rescue on stalls', () => {
    const stage = getNarrativeTrainingStage(3)!;
    expect(resolveNarrativeTrainingVisualSupport(stage, -1))
      .toEqual({ baseline: 1, stallReveal: 0, level: 1 });
    expect(resolveNarrativeTrainingVisualSupport(stage, 1))
      .toEqual({ baseline: 1, stallReveal: 2, level: 2 });
    expect(resolveNarrativeTrainingVisualSupport(stage, 2))
      .toEqual({ baseline: 1, stallReveal: 3, level: 3 });
  });
});
