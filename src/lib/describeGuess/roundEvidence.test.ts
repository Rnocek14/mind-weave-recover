import { describe, expect, it } from 'vitest';
import type { DescribeGuessTrialResult } from '@/hooks/useDescribeGuessGame';
import { classifyDescribeGuessEvidence } from './roundEvidence';
import { cueLevelToLexicalSupport } from '@/pages/DescribeGuessExercise';

const trial = (o: Partial<DescribeGuessTrialResult> = {}): DescribeGuessTrialResult => ({
  trialId: 'synthetic-trial',
  target: 'cup',
  transcript: 'you use it to drink tea',
  inputMode: 'spoken',
  browserTranscript: 'you use it to drink tea',
  meaningWin: true,
  wordWin: false,
  strategyWin: true,
  communicationWin: true,
  featureTypesUsed: ['function'],
  guessConfidence: 0.75,
  promptsShown: [],
  timeToWordRetrievalMs: null,
  selfCorrected: false,
  reactionTimeMs: 1000,
  attemptNumber: 1,
  difficulty: 1,
  ...o,
});

describe('Describe & Guess evidence provenance', () => {
  it('treats uncued, meaningful spoken description as independent practice evidence', () => {
    expect(classifyDescribeGuessEvidence(trial())).toMatchObject({
      trialMode: 'production',
      inputMode: 'spoken',
      cueCount: 0,
      practiceSuccessful: true,
      independentSpokenScoreEligible: true,
      shouldAdaptSpokenTask: true,
    });
  });

  it('retains typed successes without counting them as browser speech or adaptive language success', () => {
    expect(classifyDescribeGuessEvidence(trial({
      inputMode: 'typed', browserTranscript: null, wordWin: true,
    }))).toMatchObject({
      trialMode: 'mixed',
      practiceSuccessful: true,
      independentSpokenScoreEligible: false,
      shouldAdaptSpokenTask: false,
    });
  });

  it('recognizes all prompted attempts as semantic assistance, never phonemic/model speech', () => {
    for (const promptCount of [1, 2, 3, 5]) {
      const e = classifyDescribeGuessEvidence(trial({
        promptsShown: Array.from({ length: promptCount }, (_, i) => 'semantic chip ' + i),
      }));
      expect(e).toMatchObject({
        trialMode: 'scaffolded',
        cueCount: promptCount,
        independentSpokenScoreEligible: false,
        shouldAdaptSpokenTask: true,
      });
      expect(cueLevelToLexicalSupport(Math.min(3, promptCount))).toBe('semantic_cue');
    }
    expect(cueLevelToLexicalSupport(0)).toBe('independent');
  });

  it('abstains from independent spoken scoring when recognizer evidence is missing', () => {
    for (const browserTranscript of [null, '', '   ']) {
      const evidence = classifyDescribeGuessEvidence(trial({
        inputMode: 'spoken',
        browserTranscript,
      }));
      expect(evidence).toMatchObject({
        practiceSuccessful: true,
        independentSpokenScoreEligible: false,
        shouldAdaptSpokenTask: false,
        trialMode: 'mixed',
      });
    }
  });

  it('fails closed when the result has no trustworthy source or no meaningful response', () => {
    for (const o of [
      { inputMode: 'unknown' as const },
      { inputMode: undefined },
      { transcript: '' },
      { communicationWin: false },
    ]) {
      const e = classifyDescribeGuessEvidence(trial(o));
      expect(e.independentSpokenScoreEligible, JSON.stringify(o)).toBe(false);
    }
  });

  it('keeps an independent unsuccessful but meaningful attempt as scored failure, not no-response', () => {
    const e=classifyDescribeGuessEvidence(trial({
      meaningWin:false,wordWin:false,strategyWin:false,
    }));
    expect(e).toMatchObject({
      practiceSuccessful:false,
      independentSpokenScoreEligible:true,
      shouldAdaptSpokenTask:true,
      trialMode:'production',
    });
  });
});
