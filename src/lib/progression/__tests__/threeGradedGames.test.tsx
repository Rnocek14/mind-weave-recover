import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getDescribeGuessTrials } from '@/data/describeGuessBank';
import { ABSTRACT_COMPARE_ITEMS } from '@/data/abstractCompareStimuli';
import {
  ABSTRACT_COMPARE_CLINICAL_LEVELS, DESCRIBE_GUESS_CLINICAL_LEVELS,
  THOUGHT_CONTINUATION_CLINICAL_LEVELS, getGradedTaskSpec,
  abstractMeetsClinicalTarget, describeMeetsClinicalTarget,
  thoughtMeetsClinicalTarget, gradedTaskEvidenceMet,
} from '@/lib/progression/gradedTaskLevels';
import { getClinicalThoughtPromptPool, selectClinicalThoughtPrompt } from '@/lib/progression/gradedThoughtContent';
import { useAbstractCompareGame } from '@/hooks/useAbstractCompareGame';

describe('Clinical eight-stage tasks: real bank and scoring contracts', () => {
  it('has eight differentiated implemented clinical stages for each therapy game', () => {
    for (const table of [
      DESCRIBE_GUESS_CLINICAL_LEVELS,
      ABSTRACT_COMPARE_CLINICAL_LEVELS,
      THOUGHT_CONTINUATION_CLINICAL_LEVELS,
    ]) {
      expect(Object.keys(table)).toHaveLength(8);
      expect(new Set(Object.values(table).map(t => t.objective)).size).toBe(8);
      for (let level = 1; level <= 8; level++) {
        expect(table[level].level).toBe(level);
        expect(table[level].contentSelector.implemented).toBe(true);
        expect(table[level].minOnTargetAttempts).toBeGreaterThan(0);
      }
    }
  });

  it('serves ONLY the expected exact clinical picture bank at every Describe & Guess level', () => {
    for (let level = 1; level <= 8; level++) {
      const tier = getGradedTaskSpec('describe-guess', level).tier;
      const pool = getDescribeGuessTrials({ clinicalTier: tier, count: 8 });
      expect(pool).toHaveLength(8);
      expect(pool.every(t => t.difficulty === tier)).toBe(true);
      expect(new Set(pool.map(t => t.id)).size).toBe(8);
    }
  });

  it('Describe & Guess counts SPOKEN feature dimensions rather than tapped prompts', () => {
    expect(describeMeetsClinicalTarget({ spokenFeatureTypes: ['function'], promptsShown: [] }, 1)).toBe(true);
    expect(describeMeetsClinicalTarget({ spokenFeatureTypes: [], promptsShown: ['function','where'] }, 1)).toBe(false);
    expect(describeMeetsClinicalTarget({ spokenFeatureTypes: ['function','appearance','location'], promptsShown: [] }, 5)).toBe(true);
    expect(describeMeetsClinicalTarget({ spokenFeatureTypes: ['function','appearance','location'], promptsShown: ['help'] }, 5)).toBe(false);
    expect(describeMeetsClinicalTarget({ spokenFeatureTypes: ['function','appearance','location'], promptsShown: [] }, 8)).toBe(false);
  });

  it('has a sufficiently populated exact pair bank at every Abstract Comparison level', () => {
    for (let level = 1; level <= 8; level++) {
      const tier = getGradedTaskSpec('abstract-compare', level).tier;
      expect(ABSTRACT_COMPARE_ITEMS.filter(item => item.tier === tier).length).toBeGreaterThanOrEqual(8);
    }
  });

  it('real Abstract Comparison hook refuses to repool across its saved clinical tier', () => {
    const { result } = renderHook(() => useAbstractCompareGame(4, 1, 8));
    expect(result.current.currentItem?.tier).toBe(3);
    const before = result.current.currentItem?.id;
    act(() => result.current.setActiveTier(1));
    expect(result.current.currentItem?.id).toBe(before);
    act(() => result.current.submitAnswer(result.current.currentItem!.keyProperties[0], 1000));
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].clinicalTargetCount).toBe(3);
    expect(result.current.results[0].clinicalMet).toBe(false);
    act(() => result.current.nextItem());
    expect(result.current.currentItem?.tier).toBe(3);
  });

  it('requires all requested shared properties, not a loose generic coverage percentage', () => {
    expect(abstractMeetsClinicalTarget({ conceptCount: 1, skipped: false }, 1)).toBe(true);
    expect(abstractMeetsClinicalTarget({ conceptCount: 1, skipped: false }, 2)).toBe(false);
    expect(abstractMeetsClinicalTarget({ conceptCount: 2, skipped: false }, 7)).toBe(true);
    expect(abstractMeetsClinicalTarget({ conceptCount: 3, skipped: true }, 8)).toBe(false);
  });

  it('serves only the assigned adult prompt intent and tier at every Thought Continuation rung', () => {
    for (let level = 1; level <= 8; level++) {
      const spec = getGradedTaskSpec('thought-continuation', level);
      const pool = getClinicalThoughtPromptPool(level);
      expect(pool.length, `no valid content at L${level}`).toBeGreaterThanOrEqual(1);
      expect(pool.every(p => p.difficultyTier === spec.tier)).toBe(true);
      expect(pool.every(p => spec.thoughtIntent?.includes(p.intentType))).toBe(true);
      const first = selectClinicalThoughtPrompt(level, []);
      expect(first?.difficultyTier).toBe(spec.tier);
      const next = selectClinicalThoughtPrompt(level, [first!.id]);
      if (pool.length > 1) expect(next?.id).not.toBe(first?.id);
    }
  });

  it('treats discourse measures as cautious practice proxies and abstains without scorer evidence', () => {
    expect(thoughtMeetsClinicalTarget('milk', 1, 0.7)).toBe(true);
    expect(thoughtMeetsClinicalTarget('milk', 1, null)).toBe(false);
    expect(thoughtMeetsClinicalTarget('milk', 1, 0.1)).toBe(false);
    expect(thoughtMeetsClinicalTarget('because it seemed safer to stay inside', 4, 0.7)).toBe(true);
    expect(thoughtMeetsClinicalTarget('I like being outside', 4, 0.7)).toBe(false);
    expect(thoughtMeetsClinicalTarget('This is a long response but it does not compare two things at all', 8, undefined)).toBe(false);
    expect(thoughtMeetsClinicalTarget('I went to the store yesterday and bought some milk and bread for breakfast', 8, 0.8)).toBe(false);
    expect(thoughtMeetsClinicalTarget('Both the train and bus take people places, but a bus uses roads instead of tracks', 8, 0.8)).toBe(true);
  });

  it('never promotes from only cued trials at an independent-only rung', () => {
    const cues = Array.from({ length: 4 }, () => ({ correct: true, support: 'semantic_cue' as const }));
    const independent = Array.from({ length: 4 }, () => ({ correct: true, support: 'independent' as const }));
    expect(gradedTaskEvidenceMet(cues, 'describe-guess', 8)).toBe(false);
    expect(gradedTaskEvidenceMet(independent, 'describe-guess', 8)).toBe(true);
    expect(gradedTaskEvidenceMet(independent, 'thought-continuation', 8)).toBe(true);
    expect(gradedTaskEvidenceMet(independent.map(t=>({...t,correct:false})), 'abstract-compare', 1)).toBe(false);
  });
});
