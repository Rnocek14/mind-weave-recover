import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useWeeklySessionStats } from '../useWeeklySessionStats';
import { useSessionDetail } from '../useSessionDetail';

const backend = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: backend }));

type DbResult = { data: unknown; error: unknown };
function query(result: DbResult | Promise<DbResult>) {
  return {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(),
    then: (resolve: (value: DbResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
}
function deferred() {
  let resolve!: (value: DbResult) => void;
  const promise = new Promise<DbResult>((r) => { resolve = r; });
  return { promise, resolve };
}
const ok = (data: unknown): DbResult => ({ data, error: null });
const trial = (id: string) => ({
  attempt_id: id, target_word: id, transcript: id, is_correct: true,
  exercise_slug: 'photo_naming', created_at: '2026-09-20T12:00:00Z',
});

beforeEach(() => { backend.from.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('audit: weekly score eligibility and profile isolation', () => {
  function configureWeekly() {
    backend.from.mockImplementation((table: string) => {
      if (table === 'sessions') return query(ok([{ id: 'session-a' }]));
      if (table === 'learning_rates') return query(ok([]));
      return query(ok([
        { score: 1, validity_label: 'valid_attempt', counts_toward_score: true },
        { score: 0, validity_label: 'valid_attempt', counts_toward_score: true },
        { score: 0, validity_label: 'background_noise', counts_toward_score: false },
        { score: 1, validity_label: 'manual_confirmed', counts_toward_score: false },
      ]));
    });
  }

  it('excludes noise and manual confirmations but keeps genuine measured errors', async () => {
    configureWeekly();
    const { result } = renderHook(() => useWeeklySessionStats('profile-a'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.trialCount).toBe(2);
    expect(result.current.avgAccuracy).toBe(50);
    expect(result.current.priorAvgAccuracy).toBe(50);
  });

  it('does not display the last patient metrics after the profile is cleared', async () => {
    configureWeekly();
    const { result, rerender } = renderHook(
      ({ profileId }: { profileId: string | undefined }) => useWeeklySessionStats(profileId),
      { initialProps: { profileId: 'profile-a' as string | undefined } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({ profileId: undefined });
    expect(result.current.avgAccuracy).toBeNull();
    expect(result.current.trialCount).toBe(0);
  });

  it('ignores an old patient request that finishes after profile removal', async () => {
    const pending = deferred();
    backend.from.mockImplementation((table: string) => {
      if (table === 'sessions') return query(pending.promise);
      if (table === 'learning_rates') return query(ok([]));
      return query(ok([{ score: 1, validity_label: 'valid_attempt' }]));
    });
    const { result, rerender } = renderHook(
      ({ profileId }: { profileId: string | undefined }) => useWeeklySessionStats(profileId),
      { initialProps: { profileId: 'profile-a' as string | undefined } },
    );
    rerender({ profileId: undefined });
    await act(async () => { pending.resolve(ok([{ id: 'old-session' }])); });
    expect(result.current.avgAccuracy).toBeNull();
    expect(result.current.trialCount).toBe(0);
  });
});

describe('audit: session evidence follows the persisted writer contract', () => {
  it('reads shadow_v2 from outputs rather than nonexistent top-level columns', async () => {
    const shadow = {
      axis_scores: { wordRetrieval: { value: 1, confidence: 0.9, evidence: ['target'] } },
      strategy_used: 'spontaneous', measurement_confidence: 'high',
      verdict_primary: 'success', verdict_reason: 'Named independently.',
      shadow_v1_agreement: { v1_correct: true, v2_primary: 'success', agrees: true },
    };
    const shadowQuery = query(ok([{ attempt_id: 'a', outputs: { shadow_v2: shadow } }]));
    backend.from.mockImplementation((table: string) => table === 'utterance_analyses'
      ? query(ok([trial('a')])) : shadowQuery);
    const { result } = renderHook(() => useSessionDetail());
    await act(async () => { await result.current.fetchTrials('session-a'); });
    expect(result.current.trials[0].verdict_primary).toBe('success');
    expect(result.current.trials[0].axis_scores).toEqual(shadow.axis_scores);
    expect(shadowQuery.select.mock.calls[0][0]).toBe('attempt_id, outputs');
  });

  it('never lets an older session request replace a newer session', async () => {
    const pending = deferred();
    let requests = 0;
    backend.from.mockImplementation((table: string) => table === 'utterance_analyses'
      ? query(++requests === 1 ? pending.promise : ok([trial('new')]))
      : query(ok([])));
    const { result } = renderHook(() => useSessionDetail());
    let older!: Promise<void>;
    act(() => { older = result.current.fetchTrials('old-session'); });
    await act(async () => { await result.current.fetchTrials('new-session'); });
    expect(result.current.trials[0].attempt_id).toBe('new');
    await act(async () => { pending.resolve(ok([trial('old')])); await older; });
    expect(result.current.trials[0].attempt_id).toBe('new');
  });

  it('does not leave the previous session evidence on screen when the next load fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let requests = 0;
    backend.from.mockImplementation((table: string) => table === 'utterance_analyses'
      ? query(++requests === 1 ? ok([trial('old')]) : { data: null, error: new Error('offline') })
      : query(ok([])));
    const { result } = renderHook(() => useSessionDetail());
    await act(async () => { await result.current.fetchTrials('session-a'); });
    await act(async () => { await result.current.fetchTrials('session-b'); });
    expect(result.current.trials).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
