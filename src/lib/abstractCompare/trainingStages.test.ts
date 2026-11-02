import { describe, expect, it } from 'vitest';
import { ABSTRACT_COMPARE_ITEMS } from '@/data/abstractCompareStimuli';
import { getAbstractPracticeStage, selectAbstractPracticeItems } from './trainingStages';

describe('Abstract Comparison training — actual stage content', () => {
  it('offers three different patient instructions with the correct difficulty axis', () => {
    const a = getAbstractPracticeStage(1)!;
    const b = getAbstractPracticeStage(2)!;
    const c = getAbstractPracticeStage(3)!;
    expect(a.contentTier).toBe(1);
    expect(b.contentTier).toBe(1);
    expect(c.contentTier).toBe(2);
    expect(a.prompt).not.toEqual(b.prompt);
    expect(b.prompt).not.toEqual(c.prompt);
    expect(a.displayedSupport).toContain('Both');
    expect(b.displayedSupport).toContain('but');
    expect(c.displayedSupport).toBeNull();
    expect(a.instruction).toContain('one way');
    expect(b.instruction).toContain('different');
    expect(c.instruction).toContain('common');
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8] as const)('selects only stage %i stimulus tier without repeating or blending', level => {
    const stage = getAbstractPracticeStage(level)!;
    const original = ABSTRACT_COMPARE_ITEMS.map(item => item.id);
    const selected = selectAbstractPracticeItems(stage, 5, [], () => 0.27);
    expect(selected).toHaveLength(5);
    expect(selected.every(item => item.tier === stage.contentTier)).toBe(true);
    expect(new Set(selected.map(item => item.id)).size).toBe(5);

    const used = selected.map(x => x.id);
    const more = selectAbstractPracticeItems(stage, 5, used, () => 0.63);
    expect(more).toHaveLength(5);
    expect(more.every(item => !used.includes(item.id))).toBe(true);
    expect(more.every(item => item.tier === stage.contentTier)).toBe(true);
    expect(ABSTRACT_COMPARE_ITEMS.map(item => item.id)).toEqual(original);
  });

  it('never invents unimplemented stages or falls back to easier material after exhaustion', () => {
    [null, undefined, 0, 9, NaN, 1.5, '3'].forEach(value => {
      expect(getAbstractPracticeStage(value)).toBeNull();
    });
    const stage = getAbstractPracticeStage(3)!;
    const allUsed = ABSTRACT_COMPARE_ITEMS.filter(x => x.tier === stage.contentTier).map(x => x.id);
    expect(selectAbstractPracticeItems(stage, 4, allUsed)).toEqual([]);
    expect(selectAbstractPracticeItems(stage, -1)).toEqual([]);
    expect(selectAbstractPracticeItems(stage, 1.5)).toEqual([]);
    expect(selectAbstractPracticeItems(stage, 100).every(x => x.tier === 2)).toBe(true);
  });

  it('provides eight genuinely different tasks including an isolated novel-pair bank', () => {
    const modes = ([1, 2, 3, 4, 5, 6, 7, 8] as const).map(level => getAbstractPracticeStage(level)!);
    expect(new Set(modes.map(stage => stage.prompt)).size).toBe(8);
    expect(new Set(modes.map(stage => stage.instruction)).size).toBe(8);
    expect(modes.map(stage => stage.contentTier)).toEqual([1,1,2,2,3,3,3,3]);
    const novel = selectAbstractPracticeItems(modes[7], 5);
    expect(novel).toHaveLength(5);
    expect(novel.every(item => item.id.startsWith('ac-novel-'))).toBe(true);
    for (const stage of modes.slice(0, 7)) {
      expect(selectAbstractPracticeItems(stage, 30).every(item =>
        !item.id.startsWith('ac-novel-'))).toBe(true);
    }
    // Explanatory response scoring is intentionally not defined from this
    // content alone: the keyword scorer cannot validate two dimensions.
  });
});
