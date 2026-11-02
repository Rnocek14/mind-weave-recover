import { describe, expect, it } from 'vitest';
import { PATTERN_PRACTICE_STAGES, buildPatternPracticeChoices, getPatternPracticeStage, patternRuleForTrial } from './practiceStages';
import type { PatternItem } from './buildPatternChoices';

describe('Pattern Match — eight playable non-clinical practice formats', () => {
  it('specifies every level with a distinct playable change', () => {
    expect(PATTERN_PRACTICE_STAGES.map(s => s.level)).toEqual([1,2,3,4,5,6,7,8]);
    expect(new Set(PATTERN_PRACTICE_STAGES.map(s =>
      [s.patternSize,s.optionCount,s.previewMs,s.visibleAtAnswer,s.rule].join('/'))).size).toBe(8);
    expect(PATTERN_PRACTICE_STAGES.every(s => s.instruction && s.label)).toBe(true);
    expect(PATTERN_PRACTICE_STAGES.slice(0,2).every(s => s.visibleAtAnswer)).toBe(true);
    expect(PATTERN_PRACTICE_STAGES.slice(2).every(s => !s.visibleAtAnswer)).toBe(true);
    expect(getPatternPracticeStage(0)).toBeNull();
    expect(getPatternPracticeStage(9)).toBeNull();
    expect(getPatternPracticeStage(NaN)).toBeNull();
    expect(getPatternPracticeStage('2')).toBeNull();
  });

  it('alternates the actual matching rule at Stage 7', () => {
    const seven = getPatternPracticeStage(7)!;
    expect(patternRuleForTrial(seven,1)).toBe('shape');
    expect(patternRuleForTrial(seven,2)).toBe('color');
    expect(patternRuleForTrial(getPatternPracticeStage(8)!,2)).toBe('exact');
  });

  it.each(['shape','color'] as const)('creates one %s-correct answer independent of irrelevant features', rule => {
    const original: PatternItem[] = [
      {shape:'circle',color:'red'}, {shape:'square',color:'blue'},
      {shape:'star',color:'green'}, {shape:'triangle',color:'purple'},
    ];
    for (const seed of [0,0.3,0.999]) {
      const choices = buildPatternPracticeChoices(original,4,rule,()=>seed);
      expect(choices.options).toHaveLength(4);
      const dim = (x: PatternItem[]) => x.map(i => i[rule]).join(',');
      const key = dim(original);
      expect(choices.options.filter(x => dim(x) === key)).toHaveLength(1);
      expect(dim(choices.options[choices.correctIndex])).toBe(key);
      expect(original[0]).toEqual({shape:'circle',color:'red'});
    }
  });
});
