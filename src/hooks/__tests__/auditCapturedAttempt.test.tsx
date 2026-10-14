import { StrictMode, type PropsWithChildren } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUtteranceLogger } from '../useUtteranceLogger';
import photoSource from '@/components/PhotoNamingGame.tsx?raw';
import intelligenceSource from '@/components/patient-hub/IntelligenceTab.tsx?raw';

const db = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: db }));
const context = (word: string, sessionId = 'session-a') => ({
  targetWord: word, sessionId, userId: 'synthetic-user', exerciseSlug: 'photo_naming',
  trialIndex: 1, attemptNumber: 1,
});
const response = { transcriptSource: 'browser' as const, isCorrect: true };
function deferred() {
  let resolve!: (value: { error: unknown }) => void;
  const promise = new Promise<{ error: unknown }>((r) => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => {
  db.from.mockReset().mockReturnValue({ upsert: db.upsert });
  db.upsert.mockReset().mockResolvedValue({ error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('captured speech attempt integration contract', () => {
  it('an older game-handler closure captures the currently active attempt before async work', async () => {
    const { result } = renderHook(() => useUtteranceLogger());
    const captureFromInitialRender = result.current.captureAttempt;
    let firstId = '';
    act(() => { firstId = result.current.startAttempt(context('spoon')).attemptId; });
    act(() => { result.current.logBrowserTranscript('sp... spoon'); });
    const captured = captureFromInitialRender();
    act(() => { result.current.resetAttempt(); result.current.startAttempt(context('cup', 'session-b')); });
    act(() => { result.current.logBrowserTranscript('cup'); });
    await act(async () => { await captured.finalize(response); });
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      attempt_id: firstId, target_word: 'spoon', session_id: 'session-a', transcript: 'sp... spoon',
    });
    expect(result.current.isFinalized).toBe(false);
  });

  it('capture preserves the response-time browser transcript, not a later recognition callback', async () => {
    const { result } = renderHook(() => useUtteranceLogger());
    act(() => { result.current.startAttempt(context('spoon')); result.current.logBrowserTranscript('spoon'); });
    const captured = result.current.captureAttempt();
    act(() => { result.current.logBrowserTranscript('late recognizer text'); });
    await act(async () => { await captured.finalize(response); });
    expect(db.upsert.mock.calls[0][0].transcript).toBe('spoon');
  });

  it('capture without an active attempt cannot adopt an attempt started later', async () => {
    const { result } = renderHook(() => useUtteranceLogger());
    const missing = result.current.captureAttempt();
    act(() => { result.current.startAttempt(context('cup')); });
    let saved: unknown;
    await act(async () => { saved = await missing.finalize(response); });
    expect(saved).toMatchObject({ status: 'missing_attempt', attemptId: null });
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it('does not change the legacy callback identity on every trial render', () => {
    const { result } = renderHook(() => useUtteranceLogger());
    const original = result.current.logFinalAnalysis;
    const capture = result.current.captureAttempt;
    act(() => { result.current.startAttempt(context('spoon')); });
    expect(result.current.logFinalAnalysis).toBe(original);
    expect(result.current.captureAttempt).toBe(capture);
    act(() => { result.current.resetAttempt(); });
    expect(result.current.logFinalAnalysis).toBe(original);
  });

  it('retries reuse the original payload rather than replacing it with a newer interpretation', async () => {
    db.upsert.mockResolvedValueOnce({ error: { message: 'offline' } });
    const { result } = renderHook(() => useUtteranceLogger());
    act(() => { result.current.startAttempt(context('spoon')); });
    const captured = result.current.captureAttempt();
    const gopData = { accuracyScore: 54, words: [{ word: 'spoon' }] };
    await act(async () => { await captured.finalize({ ...response, transcript: 'spoon', gopData }); });
    const originalPayload = db.upsert.mock.calls[0][0];
    gopData.accuracyScore = 99;
    gopData.words[0].word = 'changed';
    await act(async () => { await captured.finalize({ ...response, transcript: 'different', gopData }); });
    expect(db.upsert.mock.calls[1][0]).toEqual(originalPayload);
    expect(db.upsert.mock.calls[1][0].gop_data).toMatchObject({ accuracyScore: 54, words: [{ word: 'spoon' }] });
  });

  it('does not substitute a prior transcript for an explicitly empty final response', async () => {
    const { result } = renderHook(() => useUtteranceLogger());
    act(() => { result.current.startAttempt(context('spoon')); result.current.logBrowserTranscript('old text'); });
    const captured = result.current.captureAttempt();
    await act(async () => { await captured.finalize({ ...response, transcript: '' }); });
    expect(db.upsert.mock.calls[0][0].transcript).toBe('');
  });

  it('a save acknowledged after starting another attempt does not finalize the new attempt', async () => {
    const pending = deferred();
    db.upsert.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useUtteranceLogger());
    act(() => { result.current.startAttempt(context('spoon')); });
    const captured = result.current.captureAttempt();
    const saving = captured.finalize(response);
    act(() => { result.current.startAttempt(context('cup')); });
    await act(async () => { pending.resolve({ error: null }); await saving; });
    expect(result.current.isFinalized).toBe(false);
  });

  it('retains the frozen starting identity even if a caller mutates its input object', async () => {
    const { result } = renderHook(() => useUtteranceLogger());
    const original = context('spoon');
    act(() => { result.current.startAttempt(original); });
    const captured = result.current.captureAttempt();
    original.targetWord = 'cup';
    original.sessionId = 'session-b';
    await act(async () => { await captured.finalize(response); });
    expect(db.upsert.mock.calls[0][0]).toMatchObject({ target_word: 'spoon', session_id: 'session-a' });
  });

  it('allows an already captured analysis to finish after unmount without borrowing global state', async () => {
    const { result, unmount } = renderHook(() => useUtteranceLogger());
    act(() => { result.current.startAttempt(context('spoon')); });
    const captured = result.current.captureAttempt();
    unmount();
    const outcome = await captured.finalize(response);
    expect(outcome.status).toBe('persisted');
    expect(db.upsert.mock.calls[0][0].target_word).toBe('spoon');
  });

  it('deduplicates a captured save in React StrictMode', async () => {
    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useUtteranceLogger(), { wrapper });
    act(() => { result.current.startAttempt(context('spoon')); });
    const captured = result.current.captureAttempt();
    await act(async () => { await captured.finalize(response); await captured.finalize(response); });
    expect(db.upsert).toHaveBeenCalledOnce();
  });
});

// These source-boundary checks supplement the executable hook tests. They are
// not substitutes for a full authenticated game/microphone browser test.
function section(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}
describe('game wiring and clinician claim boundaries', () => {
  it.each([
    ['  const handleAnswerSelect = async (', '  const handleCaregiverResponse = async ('],
    ['  const handleTimeout = async () => {', '  const handleRequestHint = () => {'],
  ])('captures identity before awaited work in %s', (start, end) => {
    const handler = section(photoSource, start, end);
    expect(handler.indexOf('captureAttempt()')).toBeGreaterThanOrEqual(0);
    expect(handler.indexOf('captureAttempt()')).toBeLessThan(handler.indexOf('await '));
    expect(handler).toContain('pendingAttempt.finalize({');
    expect(handler).not.toContain('logFinalAnalysis({');
  });

  it('does not derive response speed, everyday carryover, or step-down readiness from app score trends', () => {
    expect(intelligenceSource).not.toContain('Ready for step-down');
    expect(intelligenceSource).not.toContain('Faster responses');
    expect(intelligenceSource).not.toContain('transferring to daily use');
    expect(intelligenceSource).not.toContain('loadWordHistory(');
    expect(intelligenceSource).toContain('Practice observations and goals');
    expect(intelligenceSource).toContain('Everyday communication requires separate assessment.');
  });
});
