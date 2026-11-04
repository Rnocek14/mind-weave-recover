import { describe, expect, it } from 'vitest';
import {
  EARLY_PARTNER_SCENARIOS, EARLY_PARTNER_STAGES, chooseEarlyPartnerScenario,
  earlyPartnerEvidenceMet, earlyPartnerProgressDelta, earlyPartnerTurnOnTarget,
  isEarlyPartnerLevel,
} from '@/lib/progression/conversationPartnerClinical';
import type { ClinicalSignal } from '@/lib/discourseSignalScorerCore';
import type { SupportLevel } from '@/lib/progression/clinicalProgression';

const signal: ClinicalSignal = {
  onTopicScore: 0.91, targetAchievementScore: 0.8,
  responseQualityScore: 0.75, successScore: 0.8,
  errorType: 'fluent_correct', confidence: 0.83,
  source: 'llm', recommendedAdaptation: 'hold', reasoning: 'synthetic test',
};

function trials(supports: SupportLevel[], correct = true) {
  return supports.map((support, i) => ({ turnNumber: i + 1, correct, support }));
}

describe('Conversation Partner clinical content: actual L1–L3, no silent L4 fallback', () => {
  it('serves 1/2/3 real turns with graduated cue independence', () => {
    expect(Object.values(EARLY_PARTNER_STAGES).map(s => [s.level, s.turnCount, s.targetSupport]))
      .toEqual([[1, 1, 'choice_based'], [2, 2, 'semantic_cue'], [3, 3, 'independent']]);
    expect(Object.values(EARLY_PARTNER_STAGES).every(s => s.contentSelector.implemented)).toBe(true);
    expect(isEarlyPartnerLevel(3)).toBe(true);
    expect(isEarlyPartnerLevel(4)).toBe(false);
    expect(isEarlyPartnerLevel(8)).toBe(false);
  });

  it('uses bounded adult functional contexts and stays on one topic per staged dialogue', () => {
    expect(EARLY_PARTNER_SCENARIOS.length).toBeGreaterThanOrEqual(4);
    for (const s of EARLY_PARTNER_SCENARIOS) {
      expect(s.opener.length).toBeGreaterThan(12);
      expect(s.followups).toHaveLength(2);
      expect(s.choices).toHaveLength(3);
      expect(s.semanticHelp).toHaveLength(3);
    }
    expect(chooseEarlyPartnerScenario(0).id).toBe(EARLY_PARTNER_SCENARIOS[0].id);
    expect(chooseEarlyPartnerScenario(0.999).id).toBe(EARLY_PARTNER_SCENARIOS.at(-1)?.id);
  });

  it('counts a ONE-WORD meaningful on-topic utterance at L1 (no minimum sentence length)', () => {
    expect(earlyPartnerTurnOnTarget('water', signal)).toBe(true);
    expect(earlyPartnerTurnOnTarget('', signal)).toBe(false);
    expect(earlyPartnerTurnOnTarget('water', { ...signal, source: 'fallback' })).toBe(false);
    expect(earlyPartnerTurnOnTarget('water', { ...signal, source: 'shortcircuit' })).toBe(false);
    expect(earlyPartnerTurnOnTarget('water', { ...signal, onTopicScore: 0.2 })).toBe(false);
    expect(earlyPartnerTurnOnTarget('water', { ...signal, targetAchievementScore: 0.1 })).toBe(false);
    expect(earlyPartnerTurnOnTarget('water', { ...signal, confidence: 0.1 })).toBe(false);
    expect(earlyPartnerTurnOnTarget('water', { ...signal, errorType: 'off_topic' })).toBe(false);
  });

  it('requires ALL unique turns and rejects a repeated first turn as a second turn', () => {
    expect(earlyPartnerEvidenceMet(1, trials(['choice_based']))).toBe(true);
    expect(earlyPartnerEvidenceMet(2, trials(['independent', 'semantic_cue']))).toBe(true);
    expect(earlyPartnerEvidenceMet(2, [
      { turnNumber: 1, correct: true, support: 'independent' },
      { turnNumber: 1, correct: true, support: 'independent' },
    ])).toBe(false);
    expect(earlyPartnerEvidenceMet(2, trials(['independent']))).toBe(false);
    expect(earlyPartnerEvidenceMet(3, trials(['independent', 'independent', 'semantic_cue']))).toBe(false);
    expect(earlyPartnerEvidenceMet(3, trials(['independent', 'independent', 'independent']))).toBe(true);
    expect(earlyPartnerEvidenceMet(3, trials(['independent', 'independent', 'independent'], false))).toBe(false);
  });

  it('gives less practice credit after cues and no credit for unfinished exchanges', () => {
    expect(earlyPartnerProgressDelta(1, trials(['independent']))).toBe(25);
    expect(earlyPartnerProgressDelta(1, trials(['choice_based']))).toBeLessThan(25);
    expect(earlyPartnerProgressDelta(2, trials(['semantic_cue', 'independent']))).toBeLessThan(25);
    expect(earlyPartnerProgressDelta(2, trials(['independent']))).toBe(0);
    expect(earlyPartnerProgressDelta(3, [])).toBe(0);
    expect(earlyPartnerProgressDelta(3, trials(['independent', 'independent', 'independent'], false))).toBe(0);
  });
});
