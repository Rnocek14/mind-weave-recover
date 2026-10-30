import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const writes = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'utterance_analyses') throw new Error('unexpected clinical table');
      return { upsert: writes.upsert };
    },
  },
}));

import { useUtteranceLogger } from './useUtteranceLogger';

function begin(
  result: { result: { current: ReturnType<typeof useUtteranceLogger> } },
  exerciseSlug = 'conversation_partner',
) {
  let id!: string;
  act(() => {
    id = result.result.current.startAttempt({
      sessionId: 'synthetic-session',
      userId: 'synthetic-owner',
      exerciseSlug,
      trialIndex: 1,
      attemptNumber: 1,
      targetWord: 'synthetic-prompt',
    }).attemptId;
  });
  return id;
}

beforeEach(() => {
  vi.clearAllMocks();
  writes.upsert.mockResolvedValue({ error: null });
});
afterEach(() => cleanup());

describe('verified speech evidence for conversation and open-ended completion', () => {
  it('does not invent a no-response record for an open attempt', async () => {
    const result = renderHook(() => useUtteranceLogger());
    const attemptId = begin(result);
    await act(async () => {
      expect(await result.result.current.confirmFinalizedAttempts()).toBe(false);
    });
    expect(writes.upsert).not.toHaveBeenCalled();
    expect(attemptId).toEqual(expect.any(String));
  });

  it('retries a failed original utterance payload without a second clinical attempt ID', async () => {
    writes.upsert.mockResolvedValueOnce({ error: { message: 'synthetic write lost' } });
    const result = renderHook(() => useUtteranceLogger());
    const attemptId = begin(result);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await act(async () => {
        const saved = await result.result.current.logFinalAnalysis({
          attemptId,
          transcript: 'I want a glass of water',
          transcriptSource: 'browser',
          evaluationModel: 'flow',
          isCorrect: null,
          didSpeak: true,
          utteranceComplete: true,
        });
        expect(saved.status).toBe('failed');
      });
      await act(async () => {
        expect(await result.result.current.confirmFinalizedAttempts()).toBe(true);
      });
      expect(writes.upsert).toHaveBeenCalledTimes(2);
      const first = writes.upsert.mock.calls[0][0];
      const retried = writes.upsert.mock.calls[1][0];
      expect(first).toEqual(retried);
      expect(first).toMatchObject({
        attempt_id: attemptId,
        user_id: 'synthetic-owner',
        session_id: 'synthetic-session',
      });
      await act(async () => {
        expect(await result.result.current.confirmFinalizedAttempts()).toBe(true);
      });
      expect(writes.upsert).toHaveBeenCalledTimes(2);
    } finally { warn.mockRestore(); }
  });

  it('keeps session close blocked when the utterance retry is also denied', async () => {
    writes.upsert.mockResolvedValueOnce({ error: { message: 'synthetic denied' } })
      .mockResolvedValueOnce({ error: { message: 'synthetic denied again' } })
      .mockResolvedValueOnce({ error: null });
    const result = renderHook(() => useUtteranceLogger());
    const attemptId = begin(result);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await act(async () => {
        expect((await result.result.current.logFinalAnalysis({
          attemptId, transcriptSource: 'browser', transcript: 'a word',
        })).status).toBe('failed');
      });
      await act(async () => {
        expect(await result.result.current.confirmFinalizedAttempts()).toBe(false);
      });
      expect(writes.upsert).toHaveBeenCalledTimes(2);
      await act(async () => {
        expect(await result.result.current.confirmFinalizedAttempts()).toBe(true);
      });
      expect(writes.upsert).toHaveBeenCalledTimes(3);
    } finally { warn.mockRestore(); }
  });

  it('persists picture-choice provenance without fabricating spoken correctness', async () => {
    const result = renderHook(() => useUtteranceLogger());
    const attemptId = begin(result, 'photo_naming');
    await act(async () => {
      const saved = await result.result.current.logFinalAnalysis({
        attemptId,
        transcriptSource: 'browser',
        transcript: undefined,
        isCorrect: null,
        responseMode: 'recognition',
        countsTowardScore: false,
      });
      expect(saved.status).toBe('persisted');
    });
    expect(writes.upsert).toHaveBeenCalledTimes(1);
    const payload = writes.upsert.mock.calls[0][0];
    expect(payload).toMatchObject({
      attempt_id: attemptId,
      exercise_slug: 'photo_naming',
      is_correct: null,
      counts_toward_score: false,
      audio_meta: { responseMode: 'recognition' },
    });
    expect(payload.transcript).toBeNull();
  });

  it('keeps real measured speech eligible when the caller explicitly verified it', async () => {
    const result = renderHook(() => useUtteranceLogger());
    const attemptId = begin(result, 'photo_naming');
    await act(async () => {
      const saved = await result.result.current.logFinalAnalysis({
        attemptId,
        transcriptSource: 'browser',
        transcript: 'apple',
        isCorrect: true,
        responseMode: 'production',
        countsTowardScore: true,
      });
      expect(saved.status).toBe('persisted');
    });
    expect(writes.upsert.mock.calls[0][0]).toMatchObject({
      is_correct: true,
      counts_toward_score: true,
      audio_meta: { responseMode: 'production' },
    });
  });

  it('treats a session with no captured attempts as dose-only, never fabricated speech accuracy', async () => {
    const result = renderHook(() => useUtteranceLogger());
    await act(async () => {
      expect(await result.result.current.confirmFinalizedAttempts()).toBe(true);
    });
    expect(writes.upsert).not.toHaveBeenCalled();
  });
});
