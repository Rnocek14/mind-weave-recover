import { buildAzureSpeechRequest, decodeAudioBase64 } from '../_shared/azureSpeechRequest.ts';
import { finiteNumber, record, text, timedSegment } from '../_shared/azureSpeechValues.ts';
import { parseAzurePronunciationResponse, type AlignmentData, type PronunciationWord } from '../analyze-pronunciation/response.ts';

interface RetryAlignmentData {
  transcript: string;
  confidence: number | null;
  word_segments: (AlignmentData['word_segments'][number] & {
    start_time: number;
    end_time: number;
    confidence: number | null;
  })[];
  phone_segments: AlignmentData['phone_segments'];
}
interface RetryGopData {
  source: 'azure';
  overallScore: number;
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore: number | null;
  words: PronunciationWord[];
}
export type RetryPronunciationResult = {
  ok: true;
  alignmentData: RetryAlignmentData;
  gopData: RetryGopData;
} | { ok: false; error: string };

/** The staff retry path uses the same provider request and parser as live
 * analysis. Storage MIME and actual bytes must agree; this function has no
 * server-side decoder and must not relabel WebM or mp4 as WAV.
 */
export async function callAzurePronunciation(
  base64Audio: string,
  referenceText: string,
  azureKey: string,
  azureRegion: string,
  mimeType: string,
): Promise<RetryPronunciationResult> {
  try {
    const request = buildAzureSpeechRequest({
      audio: decodeAudioBase64(base64Audio), mimeType, referenceText,
      key: azureKey, region: azureRegion,
    });
    const response = await fetch(request.url, request.init);
    if (!response.ok) {
      return { ok: false, error: `Azure API ${response.status}: ${await response.text()}` };
    }

    const raw: unknown = await response.json();
    const parsed = parseAzurePronunciationResponse(raw);
    if (parsed.ok !== true) return { ok: false, error: parsed.error.message };
    const data = parsed.data;
    const azure = record(raw);
    const best = Array.isArray(azure?.NBest) ? record(azure.NBest[0]) : null;

    // Preserve the retry path's legacy confidence and timing fields alongside
    // the shared start/end format. Only words with valid measured timing are
    // eligible, in the same provider order as the shared parser's segments.
    const wordConfidences = (Array.isArray(best?.Words) ? best.Words : []).flatMap((value) => {
      const word = record(value);
      const timing = timedSegment(word);
      if (!word || !text(word.Word) || !timing || timing.duration <= 0) return [];
      const assessment = record(word.PronunciationAssessment) ?? word;
      const accuracy = finiteNumber(assessment.AccuracyScore, 0, 100);
      return [accuracy === null ? null : accuracy / 100];
    });
    const alignmentData: RetryAlignmentData = {
      transcript: data.transcript,
      confidence: finiteNumber(best?.Confidence, 0, 1),
      word_segments: (data.alignmentData?.word_segments ?? []).map((segment, index) => ({
        ...segment, start_time: segment.start, end_time: segment.end,
        confidence: wordConfidences[index] ?? null,
      })),
      phone_segments: data.alignmentData?.phone_segments ?? [],
    };
    const gopData: RetryGopData = {
      source: 'azure', overallScore: data.pronunciationScore,
      pronunciationScore: data.pronunciationScore, accuracyScore: data.accuracyScore,
      fluencyScore: data.fluencyScore, completenessScore: data.completenessScore,
      prosodyScore: data.prosodyScore, words: data.words,
    };
    return { ok: true, alignmentData, gopData };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown Azure error' };
  }
}
