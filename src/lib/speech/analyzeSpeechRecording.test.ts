import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeSpeechRecording } from './analyzeSpeechRecording';
import { pauseSecondsToMilliseconds, readSpeechMeasurements } from './analysisResponse';

const transport = vi.hoisted(() => ({ invoke: vi.fn(), convert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: transport.invoke } } }));
vi.mock('@/lib/convertToWav', () => ({ convertBlobToWav: transport.convert }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  transport.convert.mockResolvedValue(new Blob(['pcm-wav'], { type: 'audio/wav' }));
  transport.invoke.mockResolvedValue({ data: {
    transcript: 'apple', confidence: 0.91,
    acousticMetrics: { totalDurationSec: 2.5, speechRateWpm: 24, pauseCount: 0, totalPauseDurationSec: 0 },
  }, error: null });
});
afterEach(() => vi.restoreAllMocks());

describe('recorded speech analysis transport and metrics', () => {
  it.each(['audio/webm;codecs=opus', 'audio/mp4'])('converts %s before invoking the real client boundary', async mime => {
    const recorded = new Blob(['recorded-container'], { type: mime });
    const result = await analyzeSpeechRecording(recorded);
    expect(transport.convert).toHaveBeenCalledWith(recorded);
    expect(transport.invoke).toHaveBeenCalledWith('analyze-speech', {
      body: { audioBlob: btoa('pcm-wav'), mimeType: 'audio/wav' },
    });
    expect(result).toMatchObject({ transcript: 'apple', confidence: 0.91,
      acousticMetrics: { speechRateWpm: 24, pauseCount: 0, totalPauseDurationSec: 0 } });
  });

  it('does not send partial/undecodable audio when conversion fails', async () => {
    transport.convert.mockRejectedValue(new Error('Recording exceeds supported duration'));
    expect(await analyzeSpeechRecording(new Blob(['bad']))).toBeNull();
    expect(transport.invoke).not.toHaveBeenCalled();
  });

  it('keeps silence separate from a failed service and invents no scores', async () => {
    transport.invoke.mockResolvedValue({ data: { transcript: '', confidence: null, acousticMetrics: null }, error: null });
    expect(await analyzeSpeechRecording(new Blob(['silence']))).toEqual({ transcript: '', confidence: undefined, acousticMetrics: undefined });
    transport.invoke.mockResolvedValue({ data: { ok: false, error: 'Service unavailable' }, error: null });
    expect(await analyzeSpeechRecording(new Blob(['speech']))).toBeNull();
  });

  it('preserves zero while preventing null from entering legacy numeric comparisons', () => {
    const result = readSpeechMeasurements({ transcript: 'apple', confidence: 0,
      acousticMetrics: { speechRateWpm: null, pauseCount: 0, avgPauseDurationMs: null, totalPauseDurationSec: 0 } });
    expect(result.confidence).toBe(0);
    expect(result.acousticMetrics?.speechRateWpm).toBeUndefined();
    expect(result.acousticMetrics?.avgPauseDurationMs).toBeUndefined();
    expect(result.acousticMetrics?.pauseCount).toBe(0);
    expect(pauseSecondsToMilliseconds(result.acousticMetrics?.totalPauseDurationSec)).toBe(0);
  });

  it('rejects the previous deployment\'s provider-failure fallback rather than treating it as measured silence', async () => {
    transport.invoke.mockResolvedValue({ data: {
      transcript: '', confidence: 0, acousticMetrics: null,
      fallback: true, warning: 'rate_limited',
    }, error: null });
    expect(await analyzeSpeechRecording(new Blob(['speech']))).toBeNull();
  });

  it('converts observed pause seconds to milliseconds without dropping measured zero', () => {
    expect(pauseSecondsToMilliseconds(1.3)).toBe(1300);
    expect(pauseSecondsToMilliseconds(0)).toBe(0);
    expect(pauseSecondsToMilliseconds(null)).toBeUndefined();
    expect(pauseSecondsToMilliseconds(undefined)).toBeUndefined();
  });

  it.each([NaN, Infinity, -2, '80'])('rejects malformed speech rate %s', value => {
    expect(() => readSpeechMeasurements({ transcript: 'apple', confidence: 0.9,
      acousticMetrics: { speechRateWpm: value } })).toThrow('Invalid speechRateWpm');
  });

  it('treats rejected requests and missing transcripts as unavailable', async () => {
    transport.invoke.mockResolvedValue({ data: null, error: { message: 'offline' } });
    expect(await analyzeSpeechRecording(new Blob(['speech']))).toBeNull();
    transport.invoke.mockResolvedValue({ data: { confidence: 0.9 }, error: null });
    expect(await analyzeSpeechRecording(new Blob(['speech']))).toBeNull();
  });
});
