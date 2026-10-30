import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  trials: vi.fn(),
  anomalies: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (rows: unknown[]) => {
        if (table === 'adaptation_trial_logs') return db.trials(rows);
        if (table === 'adaptation_anomalies') return db.anomalies(rows);
        throw new Error('Unexpected audit write to ' + table);
      },
    }),
  },
}));

import { useAdaptationTrialLogger } from './useAdaptationTrialLogger';

function subject() {
  return renderHook(() => useAdaptationTrialLogger({
    userId: 'synthetic-owner',
    profileId: 'synthetic-patient',
    sessionId: 'synthetic-session',
    exerciseSlug: 'photo_naming',
  }));
}

function record(result: ReturnType<typeof subject>, index = 1) {
  act(() => {
    result.result.current.logTrial({
      trialIndex: index, difficulty: 2, correct: true,
      cueLevel: 0, trialMode: 'production',
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  db.trials.mockResolvedValue({ error: null });
  db.anomalies.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('verified adaptation log flush (actual production hook)', () => {
  it('does not claim clinical save on denied trial insert; preserves and retries the original row', async () => {
    db.trials
      .mockResolvedValueOnce({ error: { message: 'synthetic RLS denial' } })
      .mockResolvedValue({ error: null });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const result = subject();
      record(result);
      await act(async () => {
        expect(await result.result.current.flushVerified()).toBe(false);
      });
      expect(db.trials).toHaveBeenCalledTimes(1);
      await act(async () => {
        expect(await result.result.current.flushVerified()).toBe(true);
      });
      expect(db.trials).toHaveBeenCalledTimes(2);
      const original = db.trials.mock.calls[0][0][0];
      const retry = db.trials.mock.calls[1][0][0];
      expect(retry).toMatchObject({
        user_id: 'synthetic-owner',
        profile_id: 'synthetic-patient',
        session_id: 'synthetic-session',
        trial_index: 1,
      });
      expect(retry).toEqual(original);
      await act(async () => {
        expect(await result.result.current.flushVerified()).toBe(true);
      });
      expect(db.trials).toHaveBeenCalledTimes(2);
    } finally { errorSpy.mockRestore(); }
  });

  it('keeps confirmed adaptation attempts when anomaly storage fails afterward', async () => {
    db.anomalies
      .mockRejectedValueOnce(new Error('synthetic anomaly transport loss'))
      .mockResolvedValue({ error: null });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const result = subject();
      act(() => {
        result.result.current.logTrial({
          trialIndex: 1, difficulty: 2, correct: false,
          cueLevel: 0,
          // A known unsafe elevation produces an anomaly beside a trial row.
          cueDependency: 0.9,
          trialsAtLevel: 2,
          difficultyChange: { direction: 'up', from: 1, to: 2, reason: 'synthetic forced up' },
        });
      });
      await act(async () => {
        expect(await result.result.current.flushVerified()).toBe(false);
      });
      expect(db.trials).toHaveBeenCalledTimes(1);
      expect(db.anomalies).toHaveBeenCalledTimes(1);
      await act(async () => {
        expect(await result.result.current.flushVerified()).toBe(true);
      });
      expect(db.trials).toHaveBeenCalledTimes(1);
      expect(db.anomalies).toHaveBeenCalledTimes(2);
    } finally { errorSpy.mockRestore(); }
  });

  it('serializes overlapping manual flushes of the same trial', async () => {
    let resolve!: (value: { error: null }) => void;
    const pending = new Promise<{ error: null }>(r => { resolve = r; });
    db.trials.mockReturnValueOnce(pending);
    const result = subject();
    record(result);
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(async () => {
      first = result.result.current.flushVerified();
      second = result.result.current.flushVerified();
      await Promise.resolve();
    });
    expect(db.trials).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ error: null });
      expect(await first).toBe(true);
      expect(await second).toBe(true);
    });
    expect(db.trials).toHaveBeenCalledTimes(1);
  });
});
