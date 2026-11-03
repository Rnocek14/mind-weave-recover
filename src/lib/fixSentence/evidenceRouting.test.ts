import { describe, expect, it } from 'vitest';
import { routeFixSentenceEvidence } from './evidenceRouting';
import type { FixSentenceTrialResult } from '@/hooks/useFixSentenceGame';

const trial = (overrides: Partial<FixSentenceTrialResult> = {}): FixSentenceTrialResult => ({
  trialId: 'fs-synthetic', sentence: 'I brushed my teeth with a hammer.',
  wrongWord: 'hammer', spokenWord: 'toothbrush', matchedFix: 'toothbrush',
  isCorrect: true, isPartialCredit: false, selfCorrected: false,
  semanticSimilarity: 1, reactionTimeMs: 2200, attemptNumber: 1,
  difficulty: 2, phonemeTargets: [],
  support: 'open_response', inputMode: 'browser_recognized',
  ...overrides,
});

describe('Fix Sentence source evidence routing', () => {
  it('keeps unassisted browser recognition in expressive trials (existing behavior)', () => {
    expect(routeFixSentenceEvidence(trial())).toMatchObject({
      inputMode: 'browser_recognized', trialMode: 'production',
      browserTranscript: 'toothbrush',
      clinicalProgressionEligible: true, verifiedSpeechScoreEligible: true,
      independentSpokenScoreEligible: true,
    });
  });

  it.each(['highlight_plus_choice', 'choice_based'] as const)(
    'a correct L1/L2 %s tapped repair can count to receptive ladder, not speech',
    support => {
      expect(routeFixSentenceEvidence(trial({inputMode:'choice',support}))).toMatchObject({
        inputMode: 'choice', trialMode: 'recognition', browserTranscript: null,
        clinicalProgressionEligible: true, verifiedSpeechScoreEligible: false,
        independentSpokenScoreEligible: false,
      });
    },
  );

  it('a spoken choice-visible repair remains scaffolded, not independent speech', () => {
    const routed=routeFixSentenceEvidence(trial({support:'choice_based'}));
    expect(routed).toMatchObject({
      trialMode:'scaffolded',clinicalProgressionEligible:true,
      verifiedSpeechScoreEligible:false,independentSpokenScoreEligible:false,
      browserTranscript:'toothbrush',
    });
  });

  it.each(['typed', 'mixed', 'skipped_partial', 'unknown'] as const)(
    '%s input is recorded as practice but cannot feed expressive or clinical recovery', mode => {
      expect(routeFixSentenceEvidence(trial({inputMode:mode}))).toMatchObject({
        trialMode:'mixed',clinicalProgressionEligible:false,
        verifiedSpeechScoreEligible:false,independentSpokenScoreEligible:false,
        browserTranscript:null,
      });
    },
  );

  it('an absent or legacy channel fails closed instead of inventing a spoken response', () => {
    const routed=routeFixSentenceEvidence(trial({inputMode:undefined}));
    expect(routed.inputMode).toBe('unknown');
    expect(routed.clinicalProgressionEligible).toBe(false);
    expect(routed.browserTranscript).toBeNull();
    expect(routed.verifiedSpeechScoreEligible).toBe(false);
  });
});
