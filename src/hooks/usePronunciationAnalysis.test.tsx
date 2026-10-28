import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePronunciationAnalysis } from './usePronunciationAnalysis';

const transport = vi.hoisted(() => ({ invoke: vi.fn(), convert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: transport.invoke } } }));
vi.mock('@/lib/convertToWav', () => ({ convertBlobToWav: transport.convert }));

const measured = {
  pronunciationScore: 82, accuracyScore: 93, fluencyScore: 47,
  completenessScore: 100, prosodyScore: null, transcript: 'apple', words: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  transport.convert.mockResolvedValue(new Blob(['converted-wav'], { type: 'audio/wav' }));
  transport.invoke.mockResolvedValue({ data: { ok: true, data: measured }, error: null });
});
afterEach(() => vi.restoreAllMocks());

async function analyze() {
  const { result, unmount } = renderHook(usePronunciationAnalysis);
  const response = await result.current.analyzePronunciation(new Blob(['original-webm'], { type: 'audio/webm' }), 'apple');
  unmount();
  return response;
}

describe('real pronunciation hook response integrity', () => {
  it('sends converted WAV and preserves distinct scores without inventing optional prosody', async () => {
    const response = await analyze();
    expect(transport.invoke).toHaveBeenCalledWith('analyze-pronunciation', expect.objectContaining({
      body: expect.objectContaining({ audioBlob: btoa('converted-wav'), mimeType: 'audio/wav', referenceText: 'apple' }),
    }));
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error('Expected successful analysis');
    expect(response.data).toMatchObject({ pronunciationScore: 82, accuracyScore: 93, fluencyScore: 47, completenessScore: 100 });
    expect(response.data.prosodyScore == null).toBe(true);
  });

  it.each([undefined, null, NaN, Infinity, -1, 101])('rejects missing/invalid accuracy %s instead of showing zero or success', async score => {
    transport.invoke.mockResolvedValue({ data: { ok: true, data: { ...measured, accuracyScore: score } }, error: null });
    expect(await analyze()).toMatchObject({ ok: false, error: { stage: 'parse' } });
  });

  it('preserves a genuine zero and accepts the supported legacy envelope', async () => {
    transport.invoke.mockResolvedValue({ data: { ...measured, accuracyScore: 0 }, error: null });
    const response = await analyze();
    expect(response.ok && response.data.accuracyScore).toBe(0);
  });

  it('does not manufacture the target word when the response has no transcript', async () => {
    transport.invoke.mockResolvedValue({ data: { ...measured, transcript: undefined }, error: null });
    expect(await analyze()).toMatchObject({ ok: false, error: { stage: 'parse' } });
  });

  it('never invokes analysis when conversion fails', async () => {
    transport.convert.mockRejectedValue(new Error('Recording exceeds the supported duration'));
    expect(await analyze()).toMatchObject({ ok: false, error: { stage: 'wav_conversion' } });
    expect(transport.invoke).not.toHaveBeenCalled();
  });

  it('preserves provider and transport errors as failures', async () => {
    transport.invoke.mockResolvedValue({ data: { ok: false, error: { stage: 'azure_api', message: 'Unavailable' } }, error: null });
    expect(await analyze()).toMatchObject({ ok: false, error: { stage: 'azure_api' } });
    transport.invoke.mockResolvedValue({ data: null, error: { message: 'Network failed' } });
    expect(await analyze()).toMatchObject({ ok: false, error: { stage: 'edge_function' } });
  });
});
