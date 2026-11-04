import { describe, expect, it } from 'vitest';
import {
  EARLY_COACH_LEVELS, EARLY_COACH_SCENARIOS, buildEarlyCoachPrompt,
  chooseEarlyCoachScenario, earlyCoachEvidenceMet, earlyCoachProgressDelta,
  earlyCoachTurnOnTarget, isEarlyCoachLevel,
} from '@/lib/progression/earlyConversationCoach';
import type { ClinicalSignal } from '@/lib/discourseSignalScorerCore';
import type { SupportLevel } from '@/lib/progression/clinicalProgression';

const llmSignal: ClinicalSignal = {
  onTopicScore: 0.85, targetAchievementScore: 0.8,
  responseQualityScore: 0.7, successScore: 0.77,
  confidence: 0.8, errorType: 'fluent_correct',
  source: 'llm', reasoning: 'synthetic fixture',
  recommendedAdaptation: 'hold',
};
const trial = (support: SupportLevel, correct = true) => ({
  turnNumber: 1 as const, correct, support,
});

describe('Guided Conversation Coach: clinical content contract', () => {
  it('has real, different tasks and support targets for L1–L3, none for L4–L8', () => {
    expect(Object.values(EARLY_COACH_LEVELS).map(s => [s.level, s.mode, s.targetSupport]))
      .toEqual([
        [1, 'full_model', 'carrier_or_full_model'],
        [2, 'visual_choice', 'choice_based'],
        [3, 'open_semantic', 'independent'],
      ]);
    expect(Object.values(EARLY_COACH_LEVELS).every(s => s.contentSelector.implemented)).toBe(true);
    for (let level = 4; level <= 8; level++) expect(isEarlyCoachLevel(level)).toBe(false);
  });

  it('serves five functional adult situations with visible and audible wording', () => {
    expect(EARLY_COACH_SCENARIOS).toHaveLength(5);
    const scenario = chooseEarlyCoachScenario(0);
    expect(scenario.id).toBe('request-drink');
    expect(buildEarlyCoachPrompt(1, scenario)).toContain(scenario.modeledMessage);
    expect(buildEarlyCoachPrompt(2, scenario)).toContain(scenario.choiceQuestion);
    expect(buildEarlyCoachPrompt(3, scenario)).toContain(scenario.openQuestion);
    expect(chooseEarlyCoachScenario(0.9999)).toBe(EARLY_COACH_SCENARIOS.at(-1));
  });

  it('can accept one genuinely meaningful spoken word, never mere tapping or fallback scoring', () => {
    expect(earlyCoachTurnOnTarget('water', llmSignal)).toBe(true);
    expect(earlyCoachTurnOnTarget('', llmSignal)).toBe(false);
    expect(earlyCoachTurnOnTarget('water', { ...llmSignal, source: 'fallback' })).toBe(false);
    expect(earlyCoachTurnOnTarget('water', { ...llmSignal, source: 'shortcircuit' })).toBe(false);
    expect(earlyCoachTurnOnTarget('water', { ...llmSignal, confidence: 0.2 })).toBe(false);
    expect(earlyCoachTurnOnTarget('water', { ...llmSignal, onTopicScore: 0.2 })).toBe(false);
    expect(earlyCoachTurnOnTarget('water', { ...llmSignal, errorType: 'off_topic' })).toBe(false);
  });

  it('requires appropriate support, and never treats semantic cue as independent at L3', () => {
    expect(earlyCoachEvidenceMet(1, [trial('carrier_or_full_model')])).toBe(true);
    expect(earlyCoachEvidenceMet(1, [trial('carrier_or_full_model', false)])).toBe(false);
    expect(earlyCoachEvidenceMet(1, [])).toBe(false);
    expect(earlyCoachEvidenceMet(2, [trial('choice_based')])).toBe(true);
    expect(earlyCoachEvidenceMet(2, [trial('recognition_only')])).toBe(false);
    expect(earlyCoachEvidenceMet(3, [trial('independent')])).toBe(true);
    expect(earlyCoachEvidenceMet(3, [trial('semantic_cue')])).toBe(false);
  });

  it('has positive progress for level-appropriate trials but no clinical promotion from wrong replies', () => {
    expect(earlyCoachProgressDelta(1, [trial('carrier_or_full_model')])).toBe(25);
    expect(earlyCoachProgressDelta(2, [trial('choice_based')])).toBe(25);
    expect(earlyCoachProgressDelta(3, [trial('independent')])).toBe(25);
    expect(earlyCoachProgressDelta(3, [trial('semantic_cue')])).toBeLessThan(25);
    expect(earlyCoachProgressDelta(3, [trial('semantic_cue')])).toBeGreaterThan(0);
    expect(earlyCoachProgressDelta(3, [trial('independent', false)])).toBe(0);
    expect(earlyCoachProgressDelta(1, [])).toBe(0);
  });
});
