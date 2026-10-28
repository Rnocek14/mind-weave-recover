import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUtteranceLogger, type FinalAnalysisInput } from '../useUtteranceLogger';

// The real logger constructs and freezes the payload; only DB transport is fake.
const db = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: db }));
const context = (targetWord = 'apple') => ({
  targetWord, sessionId: 'synthetic-session', userId: 'synthetic-user',
  exerciseSlug: 'photo_naming', trialIndex: 1, attemptNumber: 1,
});
const measured = (elapsedMs: number) => ({
  version: 1 as const, basis: 'trial_start_to_answer_acceptance' as const, elapsedMs,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  db.from.mockReset().mockReturnValue({ upsert: db.upsert });
  db.upsert.mockReset().mockResolvedValue({ error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('response time is separate from analysis-completion latency', () => {
  it('saves the captured response time on its original attempt after analysis and the next trial', async () => {
    const { result } = renderHook(useUtteranceLogger);
    let firstId = '';
    act(() => { firstId = result.current.startAttempt(context()).attemptId; });
    vi.setSystemTime(102_400);
    const pending = result.current.captureAttempt();
    vi.setSystemTime(103_000);
    act(() => { result.current.startAttempt(context('cup')); });
    vi.setSystemTime(120_000);
    await act(async () => { await pending.finalize({
      transcriptSource: 'azure', responseTiming: measured(2400),
      pronunciationDiagnostics: { audioMeta: { originalMime: 'audio/webm', originalSize: 4000 } },
    }); });
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      attempt_id: firstId, target_word: 'apple', latency_ms: 20_000,
      audio_meta: { originalMime: 'audio/webm', originalSize: 4000,
        transcriptProvider: 'azure', responseTiming: measured(2400) },
    });
    expect(result.current.isFinalized).toBe(false);
  });

  it('preserves a measured zero without substituting completion latency', async () => {
    const { result } = renderHook(useUtteranceLogger);
    act(() => { result.current.startAttempt(context()); });
    vi.setSystemTime(109_000);
    await act(async () => { await result.current.logFinalAnalysis({
      transcriptSource: 'browser', responseTiming: measured(0),
    }); });
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      latency_ms: 9000, audio_meta: { responseTiming: measured(0) },
    });
  });

  it('freezes response timing on a failed write so a later retry cannot reinterpret it', async () => {
    db.upsert.mockResolvedValueOnce({ error: { message: 'offline' } });
    const { result } = renderHook(useUtteranceLogger);
    act(() => { result.current.startAttempt(context()); });
    const pending = result.current.captureAttempt();
    const responseTiming = measured(2400);
    vi.setSystemTime(120_000);
    await act(async () => { await pending.finalize({ transcriptSource: 'browser', responseTiming }); });
    responseTiming.elapsedMs = 99_000;
    vi.setSystemTime(160_000);
    await act(async () => { await pending.finalize({ transcriptSource: 'browser', responseTiming }); });
    expect(db.upsert.mock.calls[1][0]).toEqual(db.upsert.mock.calls[0][0]);
    expect(db.upsert.mock.calls[1][0]).toMatchObject({
      latency_ms: 20_000, audio_meta: { responseTiming: measured(2400) },
    });
  });

  it.each([
    undefined, null, measured(-1), measured(Number.NaN), measured(Number.POSITIVE_INFINITY),
    { version: 2, basis: 'trial_start_to_answer_acceptance', elapsedMs: 2400 },
    { version: 1, basis: 'analysis_completion', elapsedMs: 2400 },
    { version: 1, basis: 'trial_start_to_answer_acceptance', elapsedMs: '2400' },
  ])('does not invent accepted-answer timing from missing or invalid evidence: %j', async (responseTiming) => {
    const { result } = renderHook(useUtteranceLogger);
    act(() => { result.current.startAttempt(context()); });
    vi.setSystemTime(120_000);
    await act(async () => { await result.current.logFinalAnalysis({
      transcriptSource: 'browser', errorType: 'timeout', responseTiming,
    } as FinalAnalysisInput); });
    const payload = db.upsert.mock.calls[0][0];
    expect(payload.latency_ms).toBe(20_000);
    expect(payload.audio_meta?.responseTiming ?? null).toBeNull();
  });
});
