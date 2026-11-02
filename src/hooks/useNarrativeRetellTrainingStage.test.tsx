import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNarrativeRetellTrainingStage } from '@/hooks/useNarrativeRetellTrainingStage';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
}));
vi.mock('@/lib/progression/clinicalProgression', () => ({
  loadProgressionState: mocks.load,
}));

describe('useNarrativeRetellTrainingStage patient-bound read', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => cleanup());

  it('reads a persisted patient level and selects the matching runtime training stage', async () => {
    mocks.load.mockResolvedValue({ currentLevel: 3 });
    const { result } = renderHook(() =>
      useNarrativeRetellTrainingStage({ userId: 'synthetic-user', profileId: 'patient-b' }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledWith({
      userId: 'synthetic-user', profileId: 'patient-b', exerciseSlug: 'narrative-retell',
    });
    expect(result.current.stage).toMatchObject({ level: 3, storyTier: 2, baselineSupport: 1 });
  });

  it('does not invent a beginner stage when a persisted read fails', async () => {
    mocks.load.mockResolvedValue({ currentLevel: 1, loadUnavailable: true });
    const { result } = renderHook(() =>
      useNarrativeRetellTrainingStage({ userId: 'u', profileId: 'p' }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current).toMatchObject({
      loadUnavailable: true, stage: null, persistedLevel: null,
    });
  });

  it('does not query patient data for offline practice', async () => {
    const { result } = renderHook(() =>
      useNarrativeRetellTrainingStage({ offline: true }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.stage?.level).toBe(1);
    expect(result.current.persistedLevel).toBeNull();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('does not invent a clinical level without patient ownership', async () => {
    const { result } = renderHook(() =>
      useNarrativeRetellTrainingStage({ userId: 'u', profileId: null }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.loadUnavailable).toBe(true);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('discards a late first-patient response after the selected profile changes', async () => {
    let finishFirst!: (value: { currentLevel: number }) => void;
    mocks.load.mockImplementationOnce(() =>
      new Promise(resolve => { finishFirst = resolve; }));
    mocks.load.mockResolvedValueOnce({ currentLevel: 2 });
    const { result, rerender } = renderHook(
      ({ profileId }) =>
        useNarrativeRetellTrainingStage({ userId: 'u', profileId }),
      { initialProps: { profileId: 'patient-a' } },
    );
    rerender({ profileId: 'patient-b' });
    await waitFor(() => expect(result.current.stage?.level).toBe(2));
    await act(async () => { finishFirst({ currentLevel: 3 }); await Promise.resolve(); });
    expect(result.current.stage?.level).toBe(2);
  });

  it('never exposes the previous patient stage while the new patient is still loading', async () => {
    let resolveSecond!: (value: { currentLevel: number }) => void;
    mocks.load.mockResolvedValueOnce({ currentLevel: 3 });
    mocks.load.mockImplementationOnce(() =>
      new Promise(resolve => { resolveSecond = resolve; }));
    const { result, rerender } = renderHook(
      ({ profileId }) => useNarrativeRetellTrainingStage({ userId: 'u', profileId }),
      { initialProps: { profileId: 'patient-a' } },
    );
    await waitFor(() => expect(result.current.stage?.level).toBe(3));
    rerender({ profileId: 'patient-b' });
    expect(result.current).toMatchObject({
      loaded: false, stage: null, persistedLevel: null,
    });
    await act(async () => { resolveSecond({ currentLevel: 2 }); await Promise.resolve(); });
    await waitFor(() => expect(result.current.stage?.level).toBe(2));
  });

});
