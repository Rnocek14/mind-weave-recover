import { describe, expect, it } from 'vitest';
import { calculateAcousticMetrics, parseAzureSpeechResponse } from '../../../supabase/functions/analyze-speech/response';
import { parseAzureResponse, parseAzurePronunciationResponse, pronunciationResponseStatus } from '../../../supabase/functions/analyze-pronunciation/response';

// Synthetic fixtures follow the documented REST response shape. No recordings,
// credentials, patient data, or live model/service requests are used.
// https://learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text-short
const flatAssessment = () => ({
  RecognitionStatus: 'Success', Offset: 700_000, Duration: 8_400_000,
  DisplayText: 'Good morning.',
  NBest: [{
    Confidence: 0.985, Lexical: 'good morning', Display: 'Good morning.',
    PronScore: 95.1, AccuracyScore: 100, FluencyScore: 100,
    CompletenessScore: 100, ProsodyScore: 87.8,
    Words: [
      { Word: 'good', Offset: 700_000, Duration: 2_600_000, AccuracyScore: 100, ErrorType: 'None' },
      { Word: 'morning', Offset: 3_400_000, Duration: 5_700_000, AccuracyScore: 100, ErrorType: 'None' },
    ],
  }],
});

describe('Azure acoustic timing calculations', () => {
  it('uses seconds for WPM and milliseconds for average pauses, without counting the leading offset', () => {
    // Three words over a 2.5-second recognized interval; the internal gaps are
    // 300 ms and 1000 ms. One second of preceding silence is outside that span.
    const metrics = calculateAcousticMetrics([
      { Word: 'one', Offset: 10_000_000, Duration: 4_000_000 },
      { Word: 'two', Offset: 17_000_000, Duration: 4_000_000 },
      { Word: 'three', Offset: 31_000_000, Duration: 4_000_000 },
    ], 2.5, 'one two three');
    expect(metrics).toMatchObject({
      speechRateWpm: 72, totalDurationSec: 2.5, wordCount: 3,
      pauseCount: 2, avgPauseDurationMs: 650, totalPauseDurationSec: 1.3,
      speechToPauseRatio: 0.92, segmentCount: 3,
    });
  });

  it('normalizes numeric tick strings before adding offset and duration', () => {
    const metrics = calculateAcousticMetrics([
      { Word: 'one', Offset: '10000000', Duration: '4000000' },
      { Word: 'two', Offset: '17000000', Duration: '4000000' },
    ], 1.1, 'one two');
    expect(metrics.pauseCount).toBe(1);
    expect(metrics.avgPauseDurationMs).toBe(300);
  });

  it('keeps the existing greater-than-100ms pause boundary exact in integer ticks', () => {
    const metrics = calculateAcousticMetrics([
      { Word: 'one', Offset: 5_000_000, Duration: 5_000_000 },
      { Word: 'two', Offset: 11_000_000, Duration: 5_000_000 },
    ], 1.1, 'one two');
    expect(metrics.pauseCount).toBe(0);
  });

  it('does not invent measured pauses when detailed recognition contains no word timestamps', () => {
    const metrics = calculateAcousticMetrics([], 2, 'hello there');
    expect(metrics.speechRateWpm).toBe(60);
    expect(metrics.pauseCount).toBeNull();
    expect(metrics.avgPauseDurationMs).toBeNull();
    expect(metrics.totalPauseDurationSec).toBeNull();
    expect(metrics.speechToPauseRatio).toBeNull();
  });

  it('does not report a duration in seconds as a dimensionless no-pause ratio', () => {
    const metrics = calculateAcousticMetrics([
      { Word: 'hello', Offset: 0, Duration: 7_000_000 },
    ], 0.7, 'hello');
    expect(metrics.pauseCount).toBe(0);
    expect(metrics.speechToPauseRatio).toBeNull();
  });

  it('keeps an unavailable rate distinct from an observed zero', () => {
    expect(calculateAcousticMetrics([], 0, 'hello').speechRateWpm).toBeNull();
    expect(calculateAcousticMetrics([], Infinity, 'hello').totalDurationSec).toBeNull();
    expect(calculateAcousticMetrics([], 2, '').speechRateWpm).toBe(0);
  });

  it('handles overlapping or unordered segments without double-counting the silence', () => {
    const metrics = calculateAcousticMetrics([
      { Word: 'three', Offset: 30_000_000, Duration: 10_000_000 },
      { Word: 'one', Offset: 0, Duration: 20_000_000 },
      { Word: 'two', Offset: 10_000_000, Duration: 1_000_000 },
    ], 4, 'one two three');
    expect(metrics).toMatchObject({ pauseCount: 1, avgPauseDurationMs: 1000, totalPauseDurationSec: 1, speechRateWpm: 45 });
  });

  it('does not turn incomplete or contradictory timing into negative or fabricated metrics', () => {
    for (const words of [
      [{ Word: 'one', Offset: 0, Duration: 2_000_000 }, { Word: 'two' }],
      [{ Word: 'one', Offset: -1, Duration: 2_000_000 }],
      [{ Word: 'one', Offset: 0, Duration: 2_000_000 }, { Word: 'two', Offset: 99_000_000, Duration: 2_000_000 }],
    ]) {
      const metrics = calculateAcousticMetrics(words, 1, 'one two');
      expect(metrics.pauseCount).toBeNull();
      expect(metrics.speechToPauseRatio).toBeNull();
    }
  });
});

describe('Actual Azure STT response contract', () => {
  it('counts lexical spoken words instead of inverse-normalized display text', () => {
    const response = parseAzureSpeechResponse({
      RecognitionStatus: 'Success', Duration: '10000000',
      NBest: [{ Display: '$100.', Lexical: 'one hundred dollars', Confidence: 0.9 }],
    });
    expect(response.transcript).toBe('$100.');
    expect(response.acousticMetrics).toMatchObject({ wordCount: 3, speechRateWpm: 180, totalDurationSec: 1, pauseCount: null });
  });

  it('retains subsecond duration precision and does not include the leading offset in WPM', () => {
    const response = parseAzureSpeechResponse(flatAssessment());
    expect(response.acousticMetrics).toMatchObject({ totalDurationSec: 0.84, speechRateWpm: 142.9, wordCount: 2 });
  });

  it('does not infer spoken word count from display text alone', () => {
    const response = parseAzureSpeechResponse({ RecognitionStatus: 'Success', Duration: 10_000_000, DisplayText: '$100.' });
    expect(response.confidence).toBeNull();
    expect(response.acousticMetrics).toMatchObject({ wordCount: null, speechRateWpm: null, pauseCount: null });
  });

  it('preserves zero confidence but keeps missing, nonfinite and out-of-range confidence unknown', () => {
    for (const value of [0, undefined, NaN, Infinity, -1, 2]) {
      const response = parseAzureSpeechResponse({
        RecognitionStatus: 'Success', Duration: 10_000_000,
        NBest: [{ Display: 'hello', Lexical: 'hello', Confidence: value }],
      });
      expect(response.confidence).toBe(value === 0 ? 0 : null);
    }
  });

  it('does not classify absent timing as an observed 0ms recording', () => {
    const response = parseAzureSpeechResponse({ RecognitionStatus: 'Success', NBest: [{ Display: 'Hello.', Lexical: 'hello' }] });
    expect(response.acousticMetrics?.totalDurationSec).toBeNull();
    expect(response.acousticMetrics?.speechRateWpm).toBeNull();
    expect(response.validity).toBeNull();
  });

  it.each(['NoMatch', 'InitialSilenceTimeout', 'BabbleTimeout'])('represents %s without inventing speech or acoustic measurements', (status) => {
    const response = parseAzureSpeechResponse({ RecognitionStatus: status, Duration: 20_000_000 });
    expect(response).toMatchObject({ transcript: '', confidence: null, acousticMetrics: null, validity: { countsTowardScore: false } });
  });

  it.each([null, {}, { RecognitionStatus: 'Error' }, { RecognitionStatus: 'Success', NBest: [] }])('rejects malformed/provider-error response %# instead of a healthy empty result', (input) => {
    expect(() => parseAzureSpeechResponse(input)).toThrow();
  });
});

describe('Azure pronunciation response parsing', () => {
  it('reads the documented flat REST scores and converts 100ns ticks to seconds', () => {
    const data = parseAzureResponse(flatAssessment(), 'Good morning');
    expect(data).toMatchObject({
      transcript: 'Good morning.', pronunciationScore: 95.1,
      accuracyScore: 100, fluencyScore: 100, completenessScore: 100,
      prosodyScore: 87.8, duration: 0.84,
    });
    expect(data.alignmentData?.word_segments).toHaveLength(2);
    expect(data.alignmentData?.word_segments[0]).toMatchObject({ word: 'good', start: 0.07 });
    expect(data.alignmentData?.word_segments[0].end).toBeCloseTo(0.33, 7);
    expect(data.alignmentData?.word_segments[1]).toMatchObject({ word: 'morning', start: 0.34 });
    expect(data.alignmentData?.word_segments[1].end).toBeCloseTo(0.91, 7);
  });

  it('rejects absent required assessment instead of fabricating reference speech and zero scores', () => {
    expect(() => parseAzureResponse({ RecognitionStatus: 'Success', NBest: [] }, 'TARGET NEVER SPOKEN')).toThrow();
  });

  it('rejects partial, nonfinite, or wrong-type required scores', () => {
    for (const invalid of [undefined, null, NaN, Infinity, '99', -1, 101]) {
      const input = flatAssessment();
      (input.NBest[0] as Record<string, unknown>).FluencyScore = invalid;
      expect(() => parseAzureResponse(input, 'reference')).toThrow();
    }
  });

  it('preserves real zero scores while keeping unreported prosody absent', () => {
    const input = flatAssessment();
    Object.assign(input.NBest[0], {
      PronScore: 0, AccuracyScore: 0, FluencyScore: 0, CompletenessScore: 0,
    });
    delete (input.NBest[0] as Record<string, unknown>).ProsodyScore;
    expect(parseAzureResponse(input, 'reference')).toMatchObject({
      pronunciationScore: 0, accuracyScore: 0, fluencyScore: 0,
      completenessScore: 0, prosodyScore: null,
    });
  });

  it('supports the documented nested SDK assessment and phoneme candidates without dropping scores', () => {
    // https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment
    const data = parseAzureResponse({
      RecognitionStatus: 'Success', Duration: 13_800_000,
      NBest: [{ Display: 'Hello.', PronunciationAssessment: {
        PronScore: 96, AccuracyScore: 99, FluencyScore: 97, CompletenessScore: 100,
      }, Words: [{ Word: 'hello', Offset: 7_500_000, Duration: 13_800_000,
        PronunciationAssessment: { AccuracyScore: 99, ErrorType: 'None' },
        Phonemes: [{ Phoneme: 'h', Offset: 7_500_000, Duration: 3_500_000,
          PronunciationAssessment: { AccuracyScore: 98,
            NBestPhonemes: [{ Phoneme: 'h', Score: 100 }, { Phoneme: 'oʊ', Score: 52 }],
          },
        }],
      }] }],
    }, 'hello');
    expect(data.pronunciationScore).toBe(96);
    expect(data.words[0]).toMatchObject({ word: 'hello', accuracyScore: 99,
      phonemes: [{ phoneme: 'h', accuracyScore: 98, duration: 0.35,
        nbestPhonemes: [{ phoneme: 'h', score: 100 }, { phoneme: 'oʊ', score: 52 }],
      }],
    });
  });

  it('never manufactures zero-time alignment for missing timestamps', () => {
    const input = flatAssessment();
    input.NBest[0].Words = [{ Word: 'omitted', AccuracyScore: 0, ErrorType: 'Omission' }] as typeof input.NBest[0]['Words'];
    const data = parseAzureResponse(input, 'omitted');
    expect(data.words[0].accuracyScore).toBe(0);
    expect(data.alignmentData).toBeUndefined();
  });

  it('keeps missing word/phoneme scores and invalid duration separate from measured zero', () => {
    const input = flatAssessment();
    (input as Record<string, unknown>).Duration = Infinity;
    (input.NBest[0] as Record<string, unknown>).Words = [{
      Word: 'hello', Phonemes: [{ Phoneme: 'h' }, { Phoneme: 'ɛ', AccuracyScore: 0, Duration: 0 }],
    }];
    const data = parseAzureResponse(input);
    expect(data.duration).toBeNull();
    expect(data.words[0]).toMatchObject({ accuracyScore: null, errorType: null,
      phonemes: [
        { accuracyScore: null, duration: null },
        { accuracyScore: 0, duration: 0 },
      ],
    });
    expect(data.alignmentData).toBeUndefined();
    expect(JSON.stringify(data)).not.toMatch(/NaN|Infinity/);
  });

  it.each(['NoMatch', 'InitialSilenceTimeout', 'BabbleTimeout'])('returns an explicit unsuccessful assessment for %s', (status) => {
    const response = parseAzurePronunciationResponse({ RecognitionStatus: status });
    expect(response).toMatchObject({ ok: false, error: { stage: 'azure_api', details: { recognitionStatus: status } } });
    expect(response).not.toHaveProperty('data');
    expect(pronunciationResponseStatus(response)).toBe(200);
  });

  it('distinguishes provider/parse failures from a valid no-speech result in HTTP status', () => {
    for (const input of [null, {}, { RecognitionStatus: 'Error' }, { RecognitionStatus: 'Success', NBest: [] }]) {
      const response = parseAzurePronunciationResponse(input);
      expect(response.ok).toBe(false);
      expect(pronunciationResponseStatus(response)).toBe(502);
    }
    const success = parseAzurePronunciationResponse(flatAssessment());
    expect(success.ok).toBe(true);
    expect(pronunciationResponseStatus(success)).toBe(200);
  });
});
