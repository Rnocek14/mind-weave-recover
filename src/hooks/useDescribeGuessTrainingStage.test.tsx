import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDescribeGuessTrainingStage } from '@/hooks/useDescribeGuessTrainingStage';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/progression/clinicalProgression', () => ({ loadProgressionState: mocks.load }));

describe('Describe & Guess patient-scoped practice-stage loading', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('loads the selected patient, not the generic account level', async () => {
    mocks.load.mockResolvedValue({ currentLevel: 3 });
    const { result } = renderHook(() => useDescribeGuessTrainingStage({
      userId: 'account', profileId: 'patient-2',
    }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.stage).toMatchObject({ itemTier: 2, level: 3 });
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledWith({
      userId: 'account', profileId: 'patient-2', exerciseSlug: 'describe-guess',
    });
  });

  it('loads a saved Stage 8 into a real new-listener task without changing the clinical state', async () => {
    mocks.load.mockResolvedValue({currentLevel:8});
    const {result}=renderHook(()=>useDescribeGuessTrainingStage({
      userId:'account',profileId:'patient-eight',
    }));
    await waitFor(()=>expect(result.current.loaded).toBe(true));
    expect(result.current.persistedLevel).toBe(8);
    expect(result.current.stage).toMatchObject({
      level:8,itemTier:3,mode:'new_listener',situational:true,
      hideAutomaticPrompts:true,
    });
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it('fails closed without a trusted patient level', async () => {
    mocks.load.mockResolvedValue({ loadUnavailable: true, currentLevel: 1 });
    const { result } = renderHook(() => useDescribeGuessTrainingStage({ userId: 'u', profileId: 'p' }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.loadUnavailable).toBe(true);
    expect(result.current.stage).toBeNull();
  });

  it('does not expose a former patient stage during a profile switch', async () => {
    let complete!: (v: { currentLevel: number }) => void;
    mocks.load.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    mocks.load.mockResolvedValueOnce({ currentLevel: 2 });
    const { result, rerender } = renderHook(({ profileId }) =>
      useDescribeGuessTrainingStage({ userId: 'account', profileId }),
    { initialProps: { profileId: 'patient-1' } });
    rerender({ profileId: 'patient-2' });
    await waitFor(() => expect(result.current.stage?.level).toBe(2));
    await act(async () => { complete({ currentLevel: 3 }); await Promise.resolve(); });
    expect(result.current.stage?.level).toBe(2);
  });
});
