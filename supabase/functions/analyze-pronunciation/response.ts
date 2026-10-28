import { finiteNumber, record, text, ticksToSeconds, timedSegment, TICKS_PER_SECOND } from '../_shared/azureSpeechValues.ts';

interface NBestPhoneme { phoneme: string; score: number }
export interface PronunciationPhoneme {
  phoneme: string;
  accuracyScore: number | null;
  duration: number | null;
  nbestPhonemes?: NBestPhoneme[];
}
export interface PronunciationWord {
  word: string;
  accuracyScore: number | null;
  errorType: string | null;
  phonemes: PronunciationPhoneme[];
}
export interface AlignmentData {
  word_segments: { word: string; start: number; end: number }[];
  phone_segments: { phone: string; start: number; end: number }[];
}
export interface PronunciationData {
  transcript: string;
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore: number | null;
  words: PronunciationWord[];
  duration: number | null;
  alignmentData?: AlignmentData;
}
export type PronunciationResponse = { ok: true; data: PronunciationData } | {
  ok: false;
  error: { stage: 'azure_api' | 'parse'; message: string; details?: Record<string, unknown> };
};

const noSpeechStatuses = ['NoMatch', 'InitialSilenceTimeout', 'BabbleTimeout'];
const assessment = (item: Record<string, unknown>) => record(item.PronunciationAssessment) ?? item;
const score = (value: unknown) => finiteNumber(value, 0, 100);

/** Both the documented flat REST scores and nested SDK JSON assessment are
 * supported. Reference text is never evidence of what the person actually said.
 */
export function parseAzureResponse(input: unknown, _referenceText?: string): PronunciationData {
  const azure = record(input);
  const best = Array.isArray(azure?.NBest) ? record(azure.NBest[0]) : null;
  if (!azure || !best) throw new Error('Azure returned no pronunciation assessment.');
  const scores = assessment(best);
  const pronunciationScore = score(scores.PronScore);
  const accuracyScore = score(scores.AccuracyScore);
  const fluencyScore = score(scores.FluencyScore);
  const completenessScore = score(scores.CompletenessScore);
  if (pronunciationScore === null || accuracyScore === null || fluencyScore === null || completenessScore === null) {
    throw new Error('Azure returned missing or invalid required pronunciation scores.');
  }

  const words: PronunciationWord[] = [];
  const wordSegments: AlignmentData['word_segments'] = [];
  const phoneSegments: AlignmentData['phone_segments'] = [];
  for (const value of Array.isArray(best.Words) ? best.Words : []) {
    const word = record(value);
    if (!word || !text(word.Word)) continue;
    const wordScores = assessment(word);
    const wordTiming = timedSegment(word);
    if (wordTiming && wordTiming.duration > 0) {
      wordSegments.push({
        word: text(word.Word), start: wordTiming.start / TICKS_PER_SECOND,
        end: wordTiming.end / TICKS_PER_SECOND,
      });
    }
    const phonemes: PronunciationPhoneme[] = [];
    for (const value of Array.isArray(word.Phonemes) ? word.Phonemes : []) {
      const phone = record(value);
      if (!phone || !text(phone.Phoneme)) continue;
      const phoneScores = assessment(phone);
      const timing = timedSegment(phone);
      if (timing && timing.duration > 0) {
        phoneSegments.push({
          phone: text(phone.Phoneme), start: timing.start / TICKS_PER_SECOND,
          end: timing.end / TICKS_PER_SECOND,
        });
      }
      const alternatives = Array.isArray(phoneScores.NBestPhonemes) ? phoneScores.NBestPhonemes : [];
      const nbestPhonemes = alternatives.flatMap((value) => {
        const candidate = record(value);
        const candidateScore = score(candidate?.Score);
        return candidate && text(candidate.Phoneme) && candidateScore !== null
          ? [{ phoneme: text(candidate.Phoneme), score: candidateScore }] : [];
      });
      phonemes.push({
        phoneme: text(phone.Phoneme), accuracyScore: score(phoneScores.AccuracyScore),
        duration: ticksToSeconds(phone.Duration),
        ...(nbestPhonemes.length ? { nbestPhonemes } : {}),
      });
    }
    words.push({
      word: text(word.Word), accuracyScore: score(wordScores.AccuracyScore),
      errorType: text(wordScores.ErrorType) || null, phonemes,
    });
  }
  return {
    transcript: text(best.Display) || text(azure.DisplayText) || text(best.Lexical),
    pronunciationScore, accuracyScore, fluencyScore, completenessScore,
    prosodyScore: score(scores.ProsodyScore), words, duration: ticksToSeconds(azure.Duration),
    ...(wordSegments.length ? { alignmentData: { word_segments: wordSegments, phone_segments: phoneSegments } } : {}),
  };
}

/** This envelope is returned by the HTTP handler: no-speech and parser failures
 * cannot become successful zero-score assessments.
 */
export function parseAzurePronunciationResponse(input: unknown): PronunciationResponse {
  const azure = record(input);
  const status = azure?.RecognitionStatus;
  // The REST API reports Success; the documented SDK JSON sample uses 0.
  if (status !== 'Success' && status !== 0) {
    const knownStatus = typeof status === 'string';
    return { ok: false, error: {
      stage: knownStatus ? 'azure_api' : 'parse',
      message: knownStatus ? `Recognition failed: ${status}` : 'Azure pronunciation response is missing a recognition status.',
      ...(knownStatus ? { details: { recognitionStatus: status } } : {}),
    } };
  }
  try {
    return { ok: true, data: parseAzureResponse(input) };
  } catch (error) {
    return { ok: false, error: { stage: 'parse', message: error instanceof Error ? error.message : 'Invalid pronunciation response.' } };
  }
}

export function pronunciationResponseStatus(result: PronunciationResponse): number {
  if (result.ok === true) return 200;
  return noSpeechStatuses.includes(String(result.error.details?.recognitionStatus)) ? 200 : 502;
}
