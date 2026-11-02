import { describe, expect, it } from 'vitest';
import { annotateNarrativeResult, classifyNarrativeRoundEvidence } from './roundEvidence';
import type { NarrativeTrialResult } from '@/hooks/useNarrativeRetellGame';

const trial = (overrides: Partial<NarrativeTrialResult> = {}): NarrativeTrialResult => ({
  storyId: 'synthetic-story',
  transcript: 'The dog ran away and later came back to the family.',
  eventsFound: 3,
  eventsTotal: 5,
  eventCoverage: 0.6,
  matchedEvents: ['dog ran', 'returned', 'family'],
  allKeyEvents: ['dog ran', 'family searched', 'returned', 'ate', 'slept'],
  coherenceScore: 0.6,
  onTopicScore: 0.5,
  durationMs: 12000,
  meanUtteranceLength: 11,
  wordCount: 11,
  skipped: false,
  inputMode: 'spoken',
  completionReason: 'completed',
  responseValid: true,
  browserTranscript: 'The dog ran away and later came back to the family.',
  structureBreakdown: {
    beginning: { hit: 1, total: 2, status: 'partial' },
    middle: { hit: 1, total: 2, status: 'partial' },
    end: { hit: 1, total: 1, status: 'covered' },
  },
  nextStepHint: 'Try adding more detail.',
  depthTelemetry: {
    taskType: 'narrative_retell',
    eventCoverage: 0.6,
    coherenceScore: 0.6,
    ciuRate: null,
    meanUtteranceLength: 11,
  },
  ...overrides,
});

describe('Narrative Retell practice evidence and scoring boundaries', () => {
  it('uses the in-game 60% coverage criterion, not the legacy 30% reader', () => {
    expect(classifyNarrativeRoundEvidence(trial({ eventCoverage: 0.3 })))
      .toMatchObject({ practiceSuccessful: false, independentSpokenScoreEligible: true });
    expect(classifyNarrativeRoundEvidence(trial({ eventCoverage: 0.59 })).practiceSuccessful).toBe(false);
    expect(classifyNarrativeRoundEvidence(trial({ eventCoverage: 0.6 })))
      .toMatchObject({
        practiceSuccessful: true,
        independentSpokenScoreEligible: true,
        trialMode: 'production',
      });
    expect(classifyNarrativeRoundEvidence(trial({ eventCoverage: Number.NaN })))
      .toMatchObject({ practiceSuccessful: false, independentSpokenScoreEligible: false });
  });

  it('preserves typed retell practice while refusing to manufacture a browser transcript', () => {
    const typed = annotateNarrativeResult(trial(), {
      inputMode: 'typed',
      completionReason: 'completed',
      responseValid: true,
      browserTranscript: 'fabricated speech',
    });
    expect(typed).toMatchObject({
      inputMode: 'typed', browserTranscript: null, responseValid: true,
    });
    expect(classifyNarrativeRoundEvidence(typed)).toMatchObject({
      practiceSuccessful: true,
      independentSpokenScoreEligible: false,
      trialMode: 'mixed',
    });
  });

  it('retains actual spoken but assisted retells as scaffolded practice', () => {
    const assisted = trial({
      visualSupport: {
        flagEnabled: true,
        adaptiveLevel: 2,
        baselineSupport: 0,
        maxStallReveal: 2,
        maxResolvedSupport: 2,
        stallCount: 2,
        rescueTriggered: true,
      },
    });
    expect(classifyNarrativeRoundEvidence(assisted)).toMatchObject({
      practiceSuccessful: true,
      independentSpokenScoreEligible: false,
      trialMode: 'scaffolded',
      support: 'visual_or_stall_prompt',
    });
  });

  it('never treats silence, skips, invalid ASR or absent provenance as clinical speech failure', () => {
    for (const value of [
      trial({ transcript: '', browserTranscript: '', responseValid: false, skipped: true, completionReason: 'skipped' }),
      trial({ responseValid: false }),
      trial({ browserTranscript: '' }),
      trial({ inputMode: undefined, responseValid: undefined, completionReason: undefined }),
    ]) {
      expect(classifyNarrativeRoundEvidence(value).independentSpokenScoreEligible).toBe(false);
    }
  });
});
