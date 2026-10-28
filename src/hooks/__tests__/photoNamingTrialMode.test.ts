/**
 * Exercise the actual logger and inspect its database writes. The transport is
 * mocked: these tests do not establish live RLS or the game's input selection.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdaptationTrialLogger, type TrialLogInput } from '../useAdaptationTrialLogger';

const db = vi.hoisted(() => ({
  from: vi.fn(), insertTrials: vi.fn(), insertAnomalies: vi.fn(), insertEvents: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: db.from } }));

const options: Parameters<typeof useAdaptationTrialLogger>[0] = {
  userId: 'test-patient-a', profileId: 'test-profile-a', sessionId: 'test-session-a',
  exerciseSlug: 'photo-naming', enabled: true,
};
const trial: TrialLogInput = { trialIndex: 0, difficulty: 3, correct: true };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  db.from.mockReset();
  for (const insert of [db.insertTrials, db.insertAnomalies, db.insertEvents]) {
    insert.mockReset().mockResolvedValue({ error: null });
  }
  db.from.mockImplementation((table: string) => {
    if (table === 'adaptation_trial_logs') return { insert: db.insertTrials };
    if (table === 'adaptation_anomalies') return { insert: db.insertAnomalies };
    if (table === 'exercise_events') return { insert: db.insertEvents };
    throw new Error('Unexpected database table: ' + table);
  });
});

afterEach(async () => {
  await act(async () => { cleanup(); });
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Photo Naming metadata through the actual adaptation logger', () => {
  it.each(['production', 'recognition', 'scaffolded'] as const)(
    'persists %s mode with its patient, profile, session and canonical exercise',
    async (trialMode) => {
      const { result } = renderHook(() => useAdaptationTrialLogger(options));
      act(() => result.current.logTrial({
        ...trial, trialMode, archetype: 'content-expanding',
        dominantAxis: 'recognition-to-production', signalGranularity: 'boolean',
      }));
      await act(async () => { await result.current.flush(); });
      expect(db.insertTrials).toHaveBeenCalledExactlyOnceWith([
        expect.objectContaining({
          user_id: 'test-patient-a', profile_id: 'test-profile-a',
          session_id: 'test-session-a', exercise_slug: 'photo_naming',
          trial_index: 0, difficulty: 3, correct: true, trial_mode: trialMode,
          archetype: 'content-expanding', dominant_axis: 'recognition-to-production',
          signal_granularity: 'boolean',
        }),
      ]);
      expect(db.insertAnomalies).not.toHaveBeenCalled();
    },
  );

  it('preserves an incorrect response and zero-valued evidence', async () => {
    const { result } = renderHook(() => useAdaptationTrialLogger(options));
    act(() => result.current.logTrial({
      ...trial, correct: false, trialMode: 'production', gradedScore: 0,
      scaffoldLevel: 0, cueLevel: 0, cueDependency: 0, reactionTimeMs: 0,
      scoreVector: { coverage: 0 },
    }));
    await act(async () => { await result.current.flush(); });
    expect(db.insertTrials).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({
        correct: false, trial_mode: 'production', graded_score: 0,
        scaffold_level: 0, cue_level: 0, cue_dependency: 0, reaction_time_ms: 0,
        score_vector: { coverage: 0 },
      }),
    ]);
  });

  it('writes null for omitted metadata without inventing a trial mode', async () => {
    const { result } = renderHook(() => useAdaptationTrialLogger(options));
    act(() => result.current.logTrial(trial));
    await act(async () => { await result.current.flush(); });
    expect(db.insertTrials).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({
        trial_mode: null, archetype: null, dominant_axis: null,
        signal_granularity: null, graded_score: null, score_vector: null,
        scaffold_level: null,
      }),
    ]);
  });

  it('buffers in order and does not resend a successfully flushed batch', async () => {
    const { result } = renderHook(() => useAdaptationTrialLogger(options));
    act(() => {
      result.current.logTrial({ ...trial, trialMode: 'production' });
      result.current.logTrial({ ...trial, trialIndex: 1, trialMode: 'recognition' });
    });
    expect(db.insertTrials).not.toHaveBeenCalled();
    await act(async () => { await result.current.flush(); });
    expect(db.insertTrials).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ trial_index: 0, trial_mode: 'production' }),
      expect.objectContaining({ trial_index: 1, trial_mode: 'recognition' }),
    ]);
    await act(async () => { await result.current.flush(); });
    expect(db.insertTrials).toHaveBeenCalledTimes(1);
  });

  it('flushes pending metadata on the scheduled interval', async () => {
    const { result } = renderHook(() => useAdaptationTrialLogger(options));
    act(() => result.current.logTrial({ ...trial, trialMode: 'recognition' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(db.insertTrials).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ trial_mode: 'recognition' }),
    ]);
  });

  it('keeps a filtered attempt out of adaptation and records its audit reason', async () => {
    const { result } = renderHook(() => useAdaptationTrialLogger(options));
    act(() => result.current.logTrial({
      ...trial, trialMode: 'production',
      validity: { label: 'no_response', reason: 'No speech detected' },
    }));
    await act(async () => { await result.current.flush(); });
    expect(db.insertTrials).not.toHaveBeenCalled();
    expect(db.insertAnomalies).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({
        user_id: options.userId, session_id: options.sessionId,
        exercise_slug: 'photo_naming', anomaly_type: 'validity_filtered:no_response',
        detail: 'No speech detected',
      }),
    ]);
  });

  it.each([
    ['missing user', { userId: null }],
    ['missing session', { sessionId: null }],
    ['disabled logger', { enabled: false }],
  ] as const)('does not write for a %s', async (_label, overrides) => {
    const { result } = renderHook(() => useAdaptationTrialLogger({ ...options, ...overrides }));
    act(() => result.current.logTrial({ ...trial, trialMode: 'production' }));
    await act(async () => { await result.current.flush(); });
    expect(db.from).not.toHaveBeenCalled();
  });

  it('retries a rejected insert with the original trial metadata', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    db.insertTrials.mockResolvedValueOnce({ error: { message: 'temporary connection failure' } });
    const { result } = renderHook(() => useAdaptationTrialLogger(options));
    act(() => result.current.logTrial({ ...trial, trialMode: 'scaffolded' }));
    await act(async () => { await result.current.flush(); });
    const firstBatch = structuredClone(db.insertTrials.mock.calls[0][0]);
    await act(async () => { await result.current.flush(); });
    expect(db.insertTrials).toHaveBeenCalledTimes(2);
    expect(db.insertTrials.mock.calls[1][0]).toEqual(firstBatch);
    expect(firstBatch).toEqual([
      expect.objectContaining({ trial_mode: 'scaffolded', user_id: options.userId }),
    ]);
    await act(async () => { await result.current.flush(); });
    expect(db.insertTrials).toHaveBeenCalledTimes(2);
  });

  it('replays an undelivered trial after page exit with its mode and ownership', async () => {
    const first = renderHook(() => useAdaptationTrialLogger(options));
    act(() => first.result.current.logTrial({ ...trial, trialMode: 'recognition' }));
    act(() => window.dispatchEvent(new Event('pagehide')));
    first.unmount();
    expect(db.insertTrials).not.toHaveBeenCalled();
    await act(async () => { renderHook(() => useAdaptationTrialLogger(options)); });
    expect(db.insertTrials).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({
        trial_mode: 'recognition', user_id: options.userId,
        profile_id: options.profileId, session_id: options.sessionId,
      }),
    ]);
  });
});
