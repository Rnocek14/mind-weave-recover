import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_SLUGS, toProgressionSlug } from '@/lib/exerciseSlugNormalizer';
import { useThoughtContinuationTrainingStage } from './useThoughtContinuationTrainingStage';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/progression/clinicalProgression', () => ({ loadProgressionState: mocks.load }));

describe('Thought Continuation patient-owned practice-stage load', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('loads the saved patient level using the progression-slug namespace', async () => {
    mocks.load.mockResolvedValue({ currentLevel: 3 });
    const { result } = renderHook(() =>
      useThoughtContinuationTrainingStage({ userId: 'synthetic-u', profileId: 'synthetic-p' }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(CANONICAL_SLUGS.THOUGHT_CONTINUATION).toBe('thought_continuation');
    expect(toProgressionSlug(CANONICAL_SLUGS.THOUGHT_CONTINUATION)).toBe('thought-continuation');
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledWith({
      userId: 'synthetic-u', profileId: 'synthetic-p',
      exerciseSlug: toProgressionSlug(CANONICAL_SLUGS.THOUGHT_CONTINUATION),
    });
    expect(result.current).toMatchObject({
      loaded: true, loadUnavailable: false, persistedLevel: 3,
      stage: { level: 3 },
    });
  });

  it('does not silently reset a failed read to beginner practice', async () => {
    mocks.load.mockResolvedValue({ currentLevel: 1, loadUnavailable: true });
    const { result } = renderHook(() =>
      useThoughtContinuationTrainingStage({ userId: 'u', profileId: 'p' }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current).toMatchObject({
      loaded: true, loadUnavailable: true, persistedLevel: null, stage: null,
    });
  });

  it('does not pretend an L4–L8 profile has an implemented stage', async () => {
    mocks.load.mockResolvedValue({ currentLevel: 7 });
    const { result } = renderHook(() =>
      useThoughtContinuationTrainingStage({ userId: 'u', profileId: 'p' }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.persistedLevel).toBe(7);
    expect(result.current.stage).toBeNull();
  });

  it('allows explicitly offline Stage 1 participation without querying patient data', async () => {
    const { result } = renderHook(() =>
      useThoughtContinuationTrainingStage({ offline: true }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.stage?.level).toBe(1);
    expect(result.current.persistedLevel).toBeNull();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('does not invent a clinical level when ownership is missing', async () => {
    const { result } = renderHook(() =>
      useThoughtContinuationTrainingStage({ userId: 'u', profileId: null }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.loadUnavailable).toBe(true);
    expect(result.current.stage).toBeNull();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('shows no old patient stage on the first render after switching profiles', async () => {
    let resolveSecond!: (value: { currentLevel: number }) => void;
    mocks.load.mockResolvedValueOnce({ currentLevel: 3 });
    mocks.load.mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
    const { result, rerender } = renderHook(
      ({ profileId }) => useThoughtContinuationTrainingStage({ userId: 'u', profileId }),
      { initialProps: { profileId: 'patient-a' } },
    );
    await waitFor(() => expect(result.current.stage?.level).toBe(3));
    rerender({ profileId: 'patient-b' });
    expect(result.current).toMatchObject({ loaded: false, persistedLevel: null, stage: null });
    await act(async () => { resolveSecond({ currentLevel: 1 }); await Promise.resolve(); });
    await waitFor(() => expect(result.current.stage?.level).toBe(1));
  });

  it('ignores a late response from a previously selected patient', async () => {
    let resolveFirst!: (value: { currentLevel: number }) => void;
    mocks.load.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
    mocks.load.mockResolvedValueOnce({ currentLevel: 2 });
    const { result, rerender } = renderHook(
      ({ profileId }) => useThoughtContinuationTrainingStage({ userId: 'u', profileId }),
      { initialProps: { profileId: 'patient-a' } },
    );
    rerender({ profileId: 'patient-b' });
    await waitFor(() => expect(result.current.stage?.level).toBe(2));
    await act(async () => { resolveFirst({ currentLevel: 3 }); await Promise.resolve(); });
    expect(result.current.stage?.level).toBe(2);
  });
});
