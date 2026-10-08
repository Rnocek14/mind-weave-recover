import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUtteranceLogger } from '../useUtteranceLogger';

const db = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: db }));

const context = (targetWord = 'spoon', sessionId = 'session-a', userId = 'user-a') => ({
  targetWord, sessionId, userId, exerciseSlug: 'photo_naming', trialIndex: 1, attemptNumber: 1,
});
const analysis = (attemptId: string | undefined, transcript?: string) => ({
  attemptId, transcript, transcriptSource: 'browser' as const, isCorrect: true,
});
function deferred() {
  let resolve!: (value: { error: unknown }) => void;
  const promise = new Promise<{ error: unknown }>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  db.from.mockReset();
  db.upsert.mockReset().mockResolvedValue({ error: null });
  db.from.mockReturnValue({ upsert: db.upsert });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('audit: immutable speech attempt and acknowledged finalization', () => {
  it('a delayed result keeps its original attempt, session, user, target and browser transcript', async () => {
    const { result } = renderHook(() => useUtteranceLogger());
    let first!: { attemptId: string; pronRequestId: string };
    act(() => { first = result.current.startAttempt(context()); });
    act(() => { result.current.logBrowserTranscript('sp... spoon'); });
    act(() => { result.current.resetAttempt(); });
    act(() => { result.current.startAttempt(context('cup', 'session-b', 'user-b')); });
    act(() => { result.current.logBrowserTranscript('cup'); });
    await act(async () => { await result.current.logFinalAnalysis(analysis(first.attemptId)); });
    expect(db.upsert).toHaveBeenCalledOnce();
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      attempt_id: first.attemptId, session_id: 'session-a', user_id: 'user-a',
      target_word: 'spoon', transcript: 'sp... spoon',
    });
    expect(result.current.isFinalized).toBe(false);
  });

  it('does not label a pending write finalized before the backend acknowledges it', async () => {
    const pending = deferred();
    db.upsert.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useUtteranceLogger());
    let id!: string;
    act(() => { id = result.current.startAttempt(context()).attemptId; });
    let save!: ReturnType<typeof result.current.logFinalAnalysis>;
    act(() => { save = result.current.logFinalAnalysis(analysis(id, 'spoon')); });
    expect(result.current.isFinalized).toBe(false);
    await act(async () => { pending.resolve({ error: null }); await save; });
    expect(result.current.isFinalized).toBe(true);
  });

  it('returns failure and allows a retry of the same attempt after a rejected write', async () => {
    db.upsert.mockResolvedValueOnce({ error: { code: '08006', message: 'offline' } });
    const { result } = renderHook(() => useUtteranceLogger());
    let id!: string;
    act(() => { id = result.current.startAttempt(context()).attemptId; });
    let first: unknown;
    await act(async () => { first = await result.current.logFinalAnalysis(analysis(id, 'spoon')); });
    expect(first).toMatchObject({ status: 'failed', attemptId: id });
    expect(result.current.isFinalized).toBe(false);
    let second: unknown;
    await act(async () => { second = await result.current.logFinalAnalysis(analysis(id, 'spoon')); });
    expect(second).toMatchObject({ status: 'persisted', attemptId: id });
    expect(db.upsert).toHaveBeenCalledTimes(2);
    expect(db.upsert.mock.calls[0][0].attempt_id).toBe(db.upsert.mock.calls[1][0].attempt_id);
    expect(result.current.isFinalized).toBe(true);
  });

  it('recovers after a thrown transport failure without permanently locking the attempt', async () => {
    db.upsert.mockRejectedValueOnce(new Error('connection lost'));
    const { result } = renderHook(() => useUtteranceLogger());
    let id!: string;
    act(() => { id = result.current.startAttempt(context()).attemptId; });
    await act(async () => { await result.current.logFinalAnalysis(analysis(id, 'spoon')); });
    expect(result.current.isFinalized).toBe(false);
    await act(async () => { await result.current.logFinalAnalysis(analysis(id, 'spoon')); });
    expect(db.upsert).toHaveBeenCalledTimes(2);
    expect(result.current.isFinalized).toBe(true);
  });

  it('does not issue a second write while the same attempt is already saving', async () => {
    const pending = deferred();
    db.upsert.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useUtteranceLogger());
    let id!: string;
    act(() => { id = result.current.startAttempt(context()).attemptId; });
    let first!: ReturnType<typeof result.current.logFinalAnalysis>;
    act(() => { first = result.current.logFinalAnalysis(analysis(id, 'spoon')); });
    await act(async () => { await result.current.logFinalAnalysis(analysis(id, 'spoon')); });
    expect(db.upsert).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve({ error: null }); await first; });
    await act(async () => { await result.current.logFinalAnalysis(analysis(id, 'spoon')); });
    expect(db.upsert).toHaveBeenCalledOnce();
  });

  it.each(['unknown-attempt', undefined])('fails closed for an explicit missing identity: %s', async (id) => {
    const { result } = renderHook(() => useUtteranceLogger());
    act(() => { result.current.startAttempt(context()); });
    let response: unknown;
    await act(async () => { response = await result.current.logFinalAnalysis(analysis(id, 'spoon')); });
    expect(db.upsert).not.toHaveBeenCalled();
    expect(response).toMatchObject({ status: 'missing_attempt' });
  });

  it('keeps the existing synchronous legacy API working when no explicit ID is supplied', async () => {
    const { result } = renderHook(() => useUtteranceLogger());
    await act(async () => {
      result.current.startAttempt(context());
      await result.current.logFinalAnalysis({ transcript: 'spoon', transcriptSource: 'browser' });
    });
    expect(db.upsert).toHaveBeenCalledOnce();
    expect(result.current.isFinalized).toBe(true);
  });

  it('supports late finalization after reset without borrowing another attempt', async () => {
    const { result } = renderHook(() => useUtteranceLogger());
    let id!: string;
    act(() => { id = result.current.startAttempt(context()).attemptId; });
    act(() => { result.current.resetAttempt(); });
    await act(async () => { await result.current.logFinalAnalysis(analysis(id, 'spoon')); });
    expect(db.upsert.mock.calls[0][0].attempt_id).toBe(id);
    expect(result.current.currentAttemptId).toBeNull();
    expect(result.current.isFinalized).toBe(false);
  });

  it('preserves flow fields, false cue efficacy, and normalized pronunciation payloads', async () => {
    const { result } = renderHook(() => useUtteranceLogger());
    let id!: string;
    act(() => { id = result.current.startAttempt(context()).attemptId; });
    const input = {
      ...analysis(id, 'a story'), isCorrect: null, evaluationModel: 'flow' as const,
      cueWasEffective: false, cueTypeGiven: 'phonemic', momentumScore: 0.7,
      gopData: { accuracyScore: 71, transcript: 'a story', words: [] },
    };
    await act(async () => { await result.current.logFinalAnalysis(input); });
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      is_correct: null, evaluation_model: 'flow', cue_was_effective: false,
      momentum_score: 0.7, gop_data: { source: 'azure', accuracyScore: 71 },
    });
  });
});
