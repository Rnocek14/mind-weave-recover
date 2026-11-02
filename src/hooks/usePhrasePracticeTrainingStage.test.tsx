import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_SLUGS, toProgressionSlug } from '@/lib/exerciseSlugNormalizer';
import { usePhrasePracticeTrainingStage } from '@/hooks/usePhrasePracticeTrainingStage';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/progression/clinicalProgression', () => ({ loadProgressionState: mocks.load }));

describe('Phrase Practice patient-specific training stage', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('loads stage 3 for the selected patient without writing or guessing from the account', async () => {
    mocks.load.mockResolvedValue({ currentLevel: 3 });
    const { result } = renderHook(() => usePhrasePracticeTrainingStage({
      userId: 'synthetic-user', profileId: 'patient-b',
    }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    // Clinical state uses the progression namespace; raw events use telemetry.
    expect(CANONICAL_SLUGS.PHRASE_PRACTICE).toBe('phrase_practice');
    expect(toProgressionSlug(CANONICAL_SLUGS.PHRASE_PRACTICE)).toBe('phrase-practice');
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledWith({
      userId: 'synthetic-user', profileId: 'patient-b', exerciseSlug: toProgressionSlug(CANONICAL_SLUGS.PHRASE_PRACTICE),
    });
    expect(result.current.stage).toMatchObject({ level: 3, engineLevel: 3, mode: 'key_words' });
  });

  it('loads a saved Level 8 as authored conversation-repair practice without any progression writes', async () => {
    mocks.load.mockResolvedValue({currentLevel:8});
    const {result}=renderHook(()=>usePhrasePracticeTrainingStage({
      userId:'u',profileId:'synthetic-profile',
    }));
    await waitFor(()=>expect(result.current.loaded).toBe(true));
    expect(result.current.persistedLevel).toBe(8);
    expect(result.current.stage).toMatchObject({level:8,mode:'repair',engineLevel:9});
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it('never overwrites a known clinical level after a failed read', async () => {
    mocks.load.mockResolvedValue({ currentLevel: 1, loadUnavailable: true });
    const { result } = renderHook(() => usePhrasePracticeTrainingStage({ userId: 'u', profileId: 'p' }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current).toMatchObject({
      loadUnavailable: true, persistedLevel: null, stage: null,
    });
  });

  it('does not access patient data while practicing offline', async () => {
    const { result } = renderHook(() => usePhrasePracticeTrainingStage({ offline: true }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.persistedLevel).toBeNull();
    expect(result.current.stage?.level).toBe(1);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('does not use the prior profile\'s level after switching patients', async () => {
    let finish!: (v: { currentLevel: number }) => void;
    mocks.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    mocks.load.mockResolvedValueOnce({ currentLevel: 2 });
    const { result, rerender } = renderHook(({ profileId }) =>
      usePhrasePracticeTrainingStage({ userId: 'u', profileId }),
    { initialProps: { profileId: 'patient-a' } });
    rerender({ profileId: 'patient-b' });
    await waitFor(() => expect(result.current.stage?.level).toBe(2));
    await act(async () => { finish({ currentLevel: 3 }); await Promise.resolve(); });
    expect(result.current.stage?.level).toBe(2);
  });

  it('never displays a previous patient\'s level during the first render of a profile switch', async () => {
    let finishSecond!: (v: { currentLevel: number }) => void;
    mocks.load.mockResolvedValueOnce({ currentLevel: 3 });
    mocks.load.mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve; }));
    const { result, rerender } = renderHook(
      ({ profileId }) => usePhrasePracticeTrainingStage({ userId: 'u', profileId }),
      { initialProps: { profileId: 'patient-a' } },
    );
    await waitFor(() => expect(result.current.stage?.level).toBe(3));
    rerender({ profileId: 'patient-b' });
    expect(result.current.loaded).toBe(false);
    expect(result.current.stage).toBeNull();
    await act(async () => { finishSecond({ currentLevel: 2 }); await Promise.resolve(); });
    await waitFor(() => expect(result.current.stage?.level).toBe(2));
  });

});
