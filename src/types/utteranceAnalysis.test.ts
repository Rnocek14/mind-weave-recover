import { describe, expect, it } from 'vitest';
import { toUtteranceAnalysis } from './utteranceAnalysis';

const classification = {
  errorType: 'correct', confidence: 0.93, meaningAccuracy: 1,
  phonological_similarity: 0.75, phonemeAccuracy: 0.6,
  semantic_similarity: 0.8, reasoning: 'Synthetic classification',
  needs_review: false,
};

describe('toUtteranceAnalysis evidence provenance and units', () => {
  it('keeps recognition confidence separate from classification confidence', () => {
    const result = toUtteranceAnalysis('spoon', classification, 90, undefined, 0.21);
    expect(result.asrConfidence).toBe(0.21);
    expect(result.classificationConfidence).toBe(0.93);
    expect(result.phonologicalSimilarity).toBe(0.75);
    expect(result.phonemeAccuracy).toBe(0.6);
  });

  it('preserves measured zero recognition confidence', () => {
    const result = toUtteranceAnalysis('spoon', classification, 90, undefined, 0);
    expect(result.asrConfidence).toBe(0);
    expect(result.classificationConfidence).toBe(0.93);
  });

  it.each([undefined, null, Number.NaN, Infinity, -0.1, 1.1])(
    'does not borrow classifier confidence when recognition confidence is unavailable/invalid: %s',
    (asrConfidence) => {
      const result = toUtteranceAnalysis('spoon', classification, 90, undefined, asrConfidence);
      expect(result.asrConfidence).toBeUndefined();
      expect(result.classificationConfidence).toBe(0.93);
    },
  );

  it('converts backend seconds to milliseconds without changing acoustic units or measured values', () => {
    const result = toUtteranceAnalysis('four synthetic spoken words', classification, 90, {
      totalDurationSec: 3, totalDurationMs: 999,
      speechRateWpm: 80, pauseCount: 3, avgPauseDurationMs: 433,
    });
    expect(result.totalDurationMs).toBe(3000);
    expect(result.speechRateWpm).toBe(80);
    expect(result.pauseCount).toBe(3);
    expect(result.avgPauseDurationMs).toBe(433);
  });

  it('preserves genuine zero duration and acoustic measurements', () => {
    const result = toUtteranceAnalysis('', classification, 0, {
      totalDurationSec: 0, totalDurationMs: 999,
      speechRateWpm: 0, pauseCount: 0, avgPauseDurationMs: 0,
    });
    expect(result).toMatchObject({
      totalDurationMs: 0, speechRateWpm: 0, pauseCount: 0, avgPauseDurationMs: 0,
    });
  });

  it.each([undefined, null, Number.NaN, Infinity, -1])(
    'retains valid legacy milliseconds when backend seconds are unavailable: %s',
    (totalDurationSec) => {
      const result = toUtteranceAnalysis('spoon', classification, 90, {
        totalDurationSec, totalDurationMs: 1250,
      });
      expect(result.totalDurationMs).toBe(1250);
    },
  );

  it('leaves nullable acoustic observations unavailable without inferring slow speech', () => {
    const result = toUtteranceAnalysis('spoon', classification, 90, {
      totalDurationSec: null, totalDurationMs: null,
      speechRateWpm: null, pauseCount: null, avgPauseDurationMs: null,
    });
    expect(result.totalDurationMs).toBeUndefined();
    expect(result.speechRateWpm).toBeUndefined();
    expect(result.pauseCount).toBeUndefined();
    expect(result.avgPauseDurationMs).toBeUndefined();
    expect(result.effortfulSpeech).toBeUndefined();
  });

  it('does not expose malformed acoustic values as measurements', () => {
    const result = toUtteranceAnalysis('spoon', classification, 90, {
      totalDurationSec: Number.NaN, totalDurationMs: -1,
      speechRateWpm: '80', pauseCount: Infinity, avgPauseDurationMs: -50,
    });
    expect(result.totalDurationMs).toBeUndefined();
    expect(result.speechRateWpm).toBeUndefined();
    expect(result.pauseCount).toBeUndefined();
    expect(result.avgPauseDurationMs).toBeUndefined();
  });

  it('preserves the classifier effort flag rather than adding or changing its thresholds', () => {
    const result = toUtteranceAnalysis('spoon', {
      ...classification, fluencyMetrics: { effortfulSpeech: false },
    }, 90, { speechRateWpm: 85 });
    expect(result.effortfulSpeech).toBe(false);
    expect(result.encouragementScore).toBe(90);
    expect(result.errorType).toBe('correct');
  });
});
