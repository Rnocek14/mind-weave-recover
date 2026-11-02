import { describe, expect, it } from 'vitest';
import { buildManualPhraseConfirmation, VISIBLE_PHRASE_CUE_LEVEL, canSelfReportPracticeFromLegacyExercise } from './manualConfirmation';
import { classifyUtteranceValidity } from '@/lib/clinical/classifyUtteranceValidity';
import { applyValidityGate } from '@/lib/clinical/applyValidityGate';
import { reduceAccuracy } from '@/lib/sessionAccuracySummary';

describe('Phrase Practice manual confirmation cannot pose as verified spoken recovery', () => {
  it('always counts the visible target phrase as lexical support', () => {
    expect(VISIBLE_PHRASE_CUE_LEVEL).toBe(1);
  });

  it('prevents other embedded games from fabricating trials via the legacy confirmation button', () => {
    expect(canSelfReportPracticeFromLegacyExercise('word-practice')).toBe(true);
    for (const slug of ['photo-naming', 'reach-tap', 'left-side-hunt', 'meaning-match', undefined, null]) {
      expect(canSelfReportPracticeFromLegacyExercise(slug), String(slug)).toBe(false);
    }
  });

  it('preserves a user report while withholding fabricated word accuracy and ASR transcript', () => {
    const report = buildManualPhraseConfirmation({
      phraseId: 'need_help', difficulty: 4, cueLevel: 1, timeMs: 3400, attempts: 2,
    });
    expect(report).toEqual({
      correct: true,
      manualConfirmed: true,
      wordAccuracy: null,
      whisperTranscript: undefined,
      phraseId: 'need_help',
      difficulty: 4,
      cueLevel: 1,
      timeMs: 3400,
      repetitions: 3,
    });
  });

  it('maps manual reports to participation, never independent ASR accuracy', () => {
    const report = buildManualPhraseConfirmation({
      phraseId: 'need_help', difficulty: 1, cueLevel: 0, timeMs: 100, attempts: 0,
    });
    const validity = classifyUtteranceValidity({
      manualConfirmed: report.manualConfirmed,
      confirmedBy: 'user',
      asrVerified: false,
    });
    const gate = applyValidityGate(validity);
    expect(validity.validity).toBe('manual_confirmed');
    expect(gate.shouldFeedAdaptation).toBe(false);
    expect(gate.shouldCountAsrAccuracy).toBe(false);
    expect(gate.shouldCountParticipation).toBe(true);
    expect(gate.shouldCountPracticeAccuracy).toBe(true);

    const summary = reduceAccuracy([
      {
        score: 100,
        cue_level: report.cueLevel,
        counts_toward_score: validity.countsTowardScore,
        validity_label: validity.validity,
      },
    ]);
    expect(summary.accuracy).toBeNull();
    expect(summary.independent_accuracy).toBeNull();
    expect(summary.practice_accuracy).toBe(100);
    expect(summary.manual_confirmed_trials).toBe(1);
  });
});
