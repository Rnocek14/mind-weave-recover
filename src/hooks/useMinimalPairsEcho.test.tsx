import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMinimalPairsEcho } from '@/hooks/useMinimalPairsEcho';

const deps = vi.hoisted(() => ({
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  cancelRecording: vi.fn(),
  analyzePronunciation: vi.fn(),
  awaitMicSafe: vi.fn(),
  subscribeSessionPaused: vi.fn(() => () => {}),
}));

vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    startRecording: deps.startRecording,
    stopRecording: deps.stopRecording,
    cancelRecording: deps.cancelRecording,
    isSupported: true,
  }),
}));
vi.mock('@/hooks/usePronunciationAnalysis', () => ({
  usePronunciationAnalysis: () => ({ analyzePronunciation: deps.analyzePronunciation }),
}));
vi.mock('@/lib/voiceController', () => ({
  voiceController: {
    awaitMicSafe: deps.awaitMicSafe,
    get isSessionPaused() { return false; },
    subscribeSessionPaused: deps.subscribeSessionPaused,
  },
}));

const audioBlob = new Blob(['recorded speech'], { type: 'audio/webm' });
const providerResult = {
  ok: true as const,
  pronRequestId: 'pron-cat-1',
  data: { transcript: 'cat', accuracyScore: 81, pronunciationScore: 75 },
};

beforeEach(() => {
  vi.clearAllMocks();
  deps.awaitMicSafe.mockResolvedValue(true);
  deps.startRecording.mockResolvedValue(true);
  deps.stopRecording.mockResolvedValue({ audioBlob, duration: 900, mimeType: 'audio/webm' });
  deps.analyzePronunciation.mockResolvedValue(providerResult);
});

describe('Minimal Pairs spoken repetition uses real recorded provider evidence', () => {
  it('starts a recording only after Maya clears, analyzes the actual blob against the target, and preserves provider scores', async () => {
    const { result, unmount } = renderHook(() => useMinimalPairsEcho(0));
    await act(async () => { await result.current.start('cat'); });
    expect(deps.awaitMicSafe).toHaveBeenCalledOnce();
    expect(deps.startRecording).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('listening');

    await act(async () => { await result.current.finish(); });
    expect(deps.stopRecording).toHaveBeenCalledOnce();
    expect(deps.analyzePronunciation).toHaveBeenCalledWith(audioBlob, 'cat');
    expect(result.current.status).toBe('heard');
    expect(result.current.analysis).toEqual({
      transcript: 'cat', accuracyScore: 81, pronunciationScore: 75, pronRequestId: 'pron-cat-1',
    });
    unmount();
  });

  it('does not fabricate a score when audio capture returns nothing', async () => {
    deps.stopRecording.mockResolvedValue(null);
    const { result, unmount } = renderHook(() => useMinimalPairsEcho(0));
    await act(async () => { await result.current.start('hat'); });
    await act(async () => { await result.current.finish(); });
    expect(result.current.status).toBe('analysis-unavailable');
    expect(result.current.analysis).toBeNull();
    expect(deps.analyzePronunciation).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps failed Azure assessments unavailable rather than labeling the patient incorrect', async () => {
    deps.analyzePronunciation.mockResolvedValue({
      ok: false, error: { stage: 'azure_api', message: 'No speech identified' },
    });
    const { result, unmount } = renderHook(() => useMinimalPairsEcho(0));
    await act(async () => { await result.current.start('hat'); });
    await act(async () => { await result.current.finish(); });
    expect(result.current.status).toBe('analysis-unavailable');
    expect(result.current.analysis).toBeNull();
    unmount();
  });

  it('never applies a delayed provider response after the patient skips', async () => {
    let resolveAnalysis!: (value: typeof providerResult) => void;
    deps.analyzePronunciation.mockImplementation(() => new Promise(resolve => { resolveAnalysis = resolve; }));
    const { result, unmount } = renderHook(() => useMinimalPairsEcho(0));
    await act(async () => { await result.current.start('cat'); });
    let pending!: Promise<void>;
    act(() => { pending = result.current.finish(); });
    await waitFor(() => expect(deps.analyzePronunciation).toHaveBeenCalledOnce());
    act(() => { result.current.skip(); });
    await act(async () => { resolveAnalysis(providerResult); await pending; });
    expect(result.current.status).toBe('skipped');
    expect(result.current.analysis).toBeNull();
    unmount();
  });

  it('does not keep an old attempt when the trial index changes', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ trialIndex }) => useMinimalPairsEcho(trialIndex),
      { initialProps: { trialIndex: 0 } },
    );
    await act(async () => { await result.current.start('cat'); });
    expect(result.current.status).toBe('listening');
    rerender({ trialIndex: 1 });
    expect(result.current.status).toBe('idle');
    expect(result.current.analysis).toBeNull();
    expect(deps.cancelRecording).toHaveBeenCalled();
    unmount();
  });
});
