/** Validate provider-derived measurements at the browser boundary. Missing data
 * is unavailable, never a zero score or a guessed transcript. */
export class AnalysisResponseError extends Error {
  constructor(message: string) { super(message); this.name = 'AnalysisResponseError'; }
}

type RecordValue = Record<string, unknown>;
function object(value: unknown): value is RecordValue {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function measuredNumber(value: unknown, field: string, max = Infinity): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    throw new AnalysisResponseError(`Invalid ${field} measurement`);
  }
  return value;
}

export interface PronunciationMeasurements {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore?: number;
  duration?: number;
  transcript: string;
  words: unknown[];
  alignmentData?: {
    word_segments: { word: string; start: number; end: number }[];
    phone_segments: { phone: string; start: number; end: number }[];
  };
}

export function readPronunciationMeasurements(response: unknown): PronunciationMeasurements {
  if (!object(response) || response.ok === false || response.error) {
    throw new AnalysisResponseError('Pronunciation service did not return a successful analysis');
  }
  const data = object(response.data) ? response.data : response;
  const scores = {} as Pick<PronunciationMeasurements,
    'pronunciationScore' | 'accuracyScore' | 'fluencyScore' | 'completenessScore'>;
  for (const field of ['pronunciationScore', 'accuracyScore', 'fluencyScore', 'completenessScore'] as const) {
    const score = measuredNumber(data[field], field, 100);
    if (score === undefined) throw new AnalysisResponseError(`Missing ${field} measurement`);
    scores[field] = score;
  }
  if (typeof data.transcript !== 'string' || !Array.isArray(data.words)) {
    throw new AnalysisResponseError('Pronunciation response is missing transcript or word details');
  }
  return {
    ...scores,
    prosodyScore: measuredNumber(data.prosodyScore, 'prosodyScore', 100),
    duration: measuredNumber(data.duration, 'duration'),
    transcript: data.transcript,
    words: data.words,
    alignmentData: object(data.alignmentData)
      ? data.alignmentData as unknown as PronunciationMeasurements['alignmentData'] : undefined,
  };
}

const ACOUSTIC_FIELDS = [
  'speechRateWpm', 'totalDurationSec', 'wordCount', 'pauseCount',
  'avgPauseDurationMs', 'totalPauseDurationSec', 'speechToPauseRatio', 'segmentCount',
] as const;
export type ObservedAcousticMetrics = Partial<Record<typeof ACOUSTIC_FIELDS[number], number>>;

export interface SpeechMeasurements {
  transcript: string;
  confidence?: number;
  acousticMetrics?: ObservedAcousticMetrics;
}

export function readSpeechMeasurements(response: unknown): SpeechMeasurements {
  if (!object(response) || response.ok === false || response.error || response.fallback === true || typeof response.transcript !== 'string') {
    throw new AnalysisResponseError('Speech service did not return a valid transcript response');
  }
  const confidence = measuredNumber(response.confidence, 'confidence', 1);
  let acousticMetrics: ObservedAcousticMetrics | undefined;
  if (response.acousticMetrics != null) {
    if (!object(response.acousticMetrics)) throw new AnalysisResponseError('Invalid acoustic measurements');
    acousticMetrics = {};
    for (const field of ACOUSTIC_FIELDS) {
      const value = measuredNumber(response.acousticMetrics[field], field);
      // Legacy classifiers check !== undefined; passing null would incorrectly
      // compare as zero and label unavailable speech-rate data as slow speech.
      if (value !== undefined) acousticMetrics[field] = value;
    }
  }
  return { transcript: response.transcript, confidence, acousticMetrics };
}

export function pauseSecondsToMilliseconds(value: unknown): number | undefined {
  const measured = measuredNumber(value, 'totalPauseDurationSec');
  return measured === undefined ? undefined : Math.round(measured * 1000);
}
