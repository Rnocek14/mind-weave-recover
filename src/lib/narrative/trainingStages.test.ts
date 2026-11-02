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

  it('never invents an invalid patient practice stage', () => {
    for (const value of [null, undefined, 0, 9, NaN, Infinity, -1, 2.5]) {
      expect(getNarrativeTrainingStage(value)).toBeNull();
    }
  });

  it('has eight distinct tasks, real story tiers, and graduated rescue', () => {
    const all = ([1,2,3,4,5,6,7,8] as const).map(level => getNarrativeTrainingStage(level)!);
    expect(new Set(all.map(s => s.taskPrompt)).size).toBe(8);
    expect(all.map(s => s.storyTier)).toEqual([1,1,2,2,3,3,3,3]);
    expect(all.map(s => s.baselineSupport)).toEqual([3,2,1,1,1,0,0,0]);
    expect(all[7].novelOnly).toBe(true);
    expect(resolveNarrativeTrainingVisualSupport(all[7],2).level).toBe(3);
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
