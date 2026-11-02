import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAbstractPracticeStage } from './useAbstractPracticeStage';
import { CANONICAL_SLUGS, toProgressionSlug } from '@/lib/exerciseSlugNormalizer';

const mock = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/progression/clinicalProgression', () => ({ loadProgressionState: mock.load }));

describe('Abstract Comparison stage ownership', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('reads from the correct patient/progression namespace without writing', async () => {
    mock.load.mockResolvedValue({ currentLevel: 2 });
    const { result } = renderHook(() =>
      useAbstractPracticeStage({ userId: 'patient-user', profileId: 'profile-a' }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(mock.load).toHaveBeenCalledWith({
      userId: 'patient-user',
      profileId: 'profile-a',
      exerciseSlug: toProgressionSlug(CANONICAL_SLUGS.ABSTRACT_COMPARE),
    });
    expect(result.current).toMatchObject({
      loaded: true, unavailable: false,
      savedLevel: 2, stage: { level: 2, contentTier: 1 },
    });
  });

  it('does not fabricate beginner stage on a failed persistence read', async () => {
    mock.load.mockResolvedValue({ currentLevel: 1, loadUnavailable: true });
    const { result } = renderHook(() =>
      useAbstractPracticeStage({ userId: 'patient-user', profileId: 'profile-a' }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current).toMatchObject({ unavailable: true, savedLevel: null, stage: null });
  });

  it('retains saved level 8 as unimplemented without overwriting it', async () => {
    mock.load.mockResolvedValue({ currentLevel: 8 });
    const { result } = renderHook(() =>
      useAbstractPracticeStage({ userId: 'patient-user', profileId: 'profile-a' }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.savedLevel).toBe(8);
    expect(result.current.stage).toBeNull();
  });

  it('does not expose another patient stage during a profile switch', async () => {
    let resolveB!: (v: { currentLevel: number }) => void;
    mock.load.mockResolvedValueOnce({ currentLevel: 3 });
    mock.load.mockImplementationOnce(() => new Promise(resolve => { resolveB = resolve; }));
    const { result, rerender } = renderHook(
      ({ profileId }) => useAbstractPracticeStage({ userId: 'u', profileId }),
      { initialProps: { profileId: 'a' } },
    );
    await waitFor(() => expect(result.current.stage?.level).toBe(3));
    rerender({ profileId: 'b' });
    expect(result.current).toMatchObject({ loaded: false, savedLevel: null, stage: null });
    await act(async () => { resolveB({ currentLevel: 1 }); await Promise.resolve(); });
    await waitFor(() => expect(result.current.stage?.level).toBe(1));
  });

  it('discards stale profile results and never reuses them for the next profile', async () => {
    let resolveA!: (v: { currentLevel: number }) => void;
    mock.load.mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }));
    mock.load.mockResolvedValueOnce({ currentLevel: 2 });
    const { result, rerender } = renderHook(
      ({ profileId }) => useAbstractPracticeStage({ userId: 'u', profileId }),
      { initialProps: { profileId: 'a' } },
    );
    rerender({ profileId: 'b' });
    await waitFor(() => expect(result.current.stage?.level).toBe(2));
    await act(async () => { resolveA({ currentLevel: 3 }); await Promise.resolve(); });
    expect(result.current.stage?.level).toBe(2);
  });

  it('handles missing ownership and explicit offline practice separately', async () => {
    const a = renderHook(() => useAbstractPracticeStage({ userId: 'u', profileId: null }));
    await waitFor(() => expect(a.result.current.loaded).toBe(true));
    expect(a.result.current).toMatchObject({ unavailable: true, savedLevel: null, stage: null });
    a.unmount();
    const b = renderHook(() => useAbstractPracticeStage({ offline: true }));
    await waitFor(() => expect(b.result.current.loaded).toBe(true));
    expect(b.result.current.stage?.level).toBe(1);
    expect(b.result.current.savedLevel).toBeNull();
    expect(mock.load).not.toHaveBeenCalled();
  });
});
