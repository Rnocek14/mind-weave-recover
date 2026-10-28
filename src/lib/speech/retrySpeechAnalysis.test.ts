import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callAzurePronunciation } from '../../../supabase/functions/pipeline-ops/analyzeRetryAudio';

// A standard WAV written with Python's wave module: 16 mono 16-bit samples at
// 16 kHz. No patient data, decoder, service credentials, or network is used.
const wav = 'UklGRkQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
const webm = btoa(String.fromCharCode(0x1a, 0x45, 0xdf, 0xa3, 0));

// REST's documented flat assessment shape; string ticks deliberately exercise
// the JSON boundary separately from the SDK's nested assessment variant.
const assessment = () => ({
  RecognitionStatus: 'Success', Offset: '700000', Duration: '8400000',
  NBest: [{ Display: 'Good morning.', Lexical: 'good morning', Confidence: 0.91,
    PronScore: 95.1, AccuracyScore: 100, FluencyScore: 0, CompletenessScore: 100,
    Words: [
      { Word: 'good', Offset: '700000', Duration: '2600000', AccuracyScore: 0,
        Phonemes: [{ Phoneme: 'g', Offset: '700000', Duration: '600000', AccuracyScore: 0 }] },
      { Word: 'morning', Offset: '3400000', Duration: '5700000', AccuracyScore: 98 },
    ],
  }],
});

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify(assessment()), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('Actual pipeline retry analysis uses the shared Azure contract', () => {
  it('rejects stored WebM before any paid request instead of relabeling it WAV', async () => {
    const result = await callAzurePronunciation(webm, 'good morning', 'synthetic-key', 'synthetic-region', 'audio/webm');
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/Convert this recording/) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a false WAV content type when the stored bytes are another container', async () => {
    const result = await callAzurePronunciation(webm, 'good morning', 'synthetic-key', 'synthetic-region', 'audio/wav');
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/RIFF\/WAVE/) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps real flat REST scores and exact timing units, including real zero and unavailable prosody', async () => {
    const result = await callAzurePronunciation(wav, 'good morning', 'synthetic-key', 'synthetic-region', 'audio/wav');
    expect(result).toMatchObject({ ok: true, gopData: {
      source: 'azure', overallScore: 95.1, pronunciationScore: 95.1, accuracyScore: 100,
      fluencyScore: 0, completenessScore: 100, prosodyScore: null,
      words: [{ word: 'good', accuracyScore: 0 }, { word: 'morning', accuracyScore: 98 }],
    } });
    if (result.ok !== true) throw new Error(result.error);
    expect(result.alignmentData?.word_segments).toMatchObject([
      { word: 'good', start: 0.07, end: 0.33, start_time: 0.07, end_time: 0.33, confidence: 0 },
      { word: 'morning', start: 0.34, end: 0.91, start_time: 0.34, end_time: 0.91, confidence: 0.98 },
    ]);
    expect(result.alignmentData?.phone_segments).toEqual([{ phone: 'g', start: 0.07, end: 0.13 }]);
    const [url, request] = fetchMock.mock.calls[0];
    expect(new URL(url).searchParams.get('format')).toBe('detailed');
    expect(new Headers(request.headers).get('Content-Type')).toBe('audio/wav; codecs=audio/pcm; samplerate=16000');
    expect(new Uint8Array(request.body as ArrayBuffer)).toEqual(Uint8Array.from(atob(wav), c => c.charCodeAt(0)));
  });

  it('does not mark an unassessed success as complete with invented zero scores', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      RecognitionStatus: 'Success', NBest: [{ Display: 'Good morning.' }],
    })));
    const result = await callAzurePronunciation(wav, 'good morning', 'synthetic-key', 'synthetic-region', 'audio/wav');
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/missing or invalid required pronunciation scores/i) });
    expect(result).not.toHaveProperty('gopData');
  });

  it('keeps missing timing and confidence unavailable without shifting later word evidence', async () => {
    const resultBody = assessment();
    resultBody.NBest[0] = {
      ...resultBody.NBest[0], Confidence: undefined,
      Words: [
        { Word: 'untimed', AccuracyScore: 99 },
        { Word: 'good', Offset: '700000', Duration: '2600000' },
        { Word: 'morning', Offset: '3400000', Duration: '5700000', AccuracyScore: 98 },
      ],
    } as typeof resultBody.NBest[0];
    fetchMock.mockResolvedValue(new Response(JSON.stringify(resultBody)));
    const result = await callAzurePronunciation(wav, 'good morning', 'synthetic-key', 'synthetic-region', 'audio/wav');
    expect(result).toMatchObject({ ok: true, alignmentData: {
      confidence: null,
      word_segments: [{ word: 'good', confidence: null }, { word: 'morning', confidence: 0.98 }],
    } });
  });

  it.each([
    ['NoMatch', 200, JSON.stringify({ RecognitionStatus: 'NoMatch' }), /Recognition failed: NoMatch/],
    ['rate limit', 429, 'Rate limited', /Azure API 429: Rate limited/],
    ['invalid JSON', 200, 'not-json', /JSON|Unexpected token/],
  ])('returns an explicit retry failure for %s without supplying scores', async (_name, status, body, expected) => {
    fetchMock.mockResolvedValue(new Response(body, { status }));
    const result = await callAzurePronunciation(wav, 'good morning', 'synthetic-key', 'synthetic-region', 'audio/wav');
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(expected) });
    expect(result).not.toHaveProperty('gopData');
    expect(result).not.toHaveProperty('alignmentData');
  });
});
