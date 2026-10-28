import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationSpeechAnalysis } from './useConversationSpeechAnalysis';

const boundary = vi.hoisted(() => ({ invoke: vi.fn(), convert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: boundary.invoke } } }));
vi.mock('@/lib/convertToWav', () => ({ convertBlobToWav: boundary.convert }));

const context = { userId: 'synthetic-user', profileId: 'synthetic-profile', sessionId: 'synthetic-session' };
const assessment = () => ({ ok: true, data: {
  pronunciationScore: 80, accuracyScore: 82, fluencyScore: 0, completenessScore: 100,
  prosodyScore: null, transcript: 'apple', words: [{ word: 'apple', phonemes: [
    { phoneme: 'missing', accuracyScore: null },
    { phoneme: 'zero', accuracyScore: 0 },
    { phoneme: 'measured', accuracyScore: 72 },
  ] }],
} });

beforeEach(() => {
  boundary.invoke.mockReset().mockResolvedValue({ data: assessment(), error: null });
  boundary.convert.mockReset().mockResolvedValue(new Blob(['RIFF synthetic converted WAV'], { type: 'audio/wav' }));
});

/** The actual conversation and shared pronunciation hooks run. Only decoding
 * hardware and the Supabase transport are controlled at their boundaries. */
async function startAnalysis(result: { current: ReturnType<typeof useConversationSpeechAnalysis> }) {
  const recording = new Blob(['x'.repeat(1500)], { type: 'audio/webm' });
  await act(async () => { await result.current.analyzeUtterance('apple', null, 1000, recording); });
  await waitFor(() => expect(boundary.invoke).toHaveBeenCalledTimes(1));
  await act(async () => {});
  return recording;
}

describe('Conversation pronunciation uses the supported shared contract', () => {
  it('converts original recorder data to WAV before invoking the actual analysis endpoint', async () => {
    const { result } = renderHook(() => useConversationSpeechAnalysis(context));
    const recording = await startAnalysis(result);
    expect(boundary.convert).toHaveBeenCalledExactlyOnceWith(recording);
    expect(boundary.invoke).toHaveBeenCalledWith('analyze-pronunciation', expect.objectContaining({
      body: expect.objectContaining({ mimeType: 'audio/wav', referenceText: 'apple', audioBlob: btoa('RIFF synthetic converted WAV') }),
    }));
  });

  it('does not classify unmeasured phonemes as zero, while preserving a real zero', async () => {
    const { result } = renderHook(() => useConversationSpeechAnalysis(context));
    await startAnalysis(result);
    const next = await result.current.analyzeUtterance('next turn', null, 1000);
    expect(next.phonemeAccuracy).toEqual([{ phoneme: 'zero', score: 0 }, { phoneme: 'measured', score: 72 }]);
    expect(next.challengingSounds).toEqual(['zero']);
    expect(next.pronunciationScore).toBe(80);
  });

  it('rejects incomplete success envelopes instead of caching unsupported scores', async () => {
    boundary.invoke.mockResolvedValue({ data: { ok: true, data: { pronunciationScore: 80, transcript: 'apple', words: [] } }, error: null });
    const { result } = renderHook(() => useConversationSpeechAnalysis(context));
    await startAnalysis(result);
    const next = await result.current.analyzeUtterance('next turn', null, 1000);
    expect(next.pronunciationScore).toBeNull();
    expect(next.phonemeAccuracy).toEqual([]);
  });
});
