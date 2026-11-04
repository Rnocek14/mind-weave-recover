/**
 * Exercises the production Conversation Partner hook through three turns.
 * Supabase transport is inert and synthetic; this is NOT an RLS / persistence
 * integration test.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationPartner } from '@/hooks/useConversationPartner';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(async () => ({ data: { followupType: 'wrap_up' }, error: null })),
  insert: vi.fn(async () => ({ data: null, error: null })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    from: () => ({ insert: mocks.insert }),
  },
}));

beforeEach(() => { vi.clearAllMocks(); });

describe('useConversationPartner session summary source', () => {
  it('returns final-turn metrics from the actual hook instead of using pre-update React state', async () => {
    const { result } = renderHook(() => useConversationPartner({
      userId: 'synthetic-user',
      profileId: 'synthetic-profile',
      sessionId: 'synthetic-session',
      maxTurns: 3,
    }));
    let last: Awaited<ReturnType<typeof result.current.processUserTurn>> | null = null;

    await act(async () => {
      result.current.addAITurn('What did you eat?');
    });
    await act(async () => {
      last = await result.current.processUserTurn('I had oatmeal', 1200);
    });
    expect(last!.updatedMetrics).toMatchObject({
      totalUserWords: 3,
      turnsCompleted: 1,
      avgLatencyMs: 1200,
      completionRate: 100,
    });

    await act(async () => {
      result.current.addAITurn('What did you drink?');
    });
    await act(async () => {
      last = await result.current.processUserTurn('coffee', 900);
    });
    expect(last!.updatedMetrics).toMatchObject({
      totalUserWords: 4,
      turnsCompleted: 2,
      avgLatencyMs: 1050,
      completionRate: 50, // named 2+ word replies, not clinical quality
    });

    await act(async () => {
      result.current.addAITurn('Did you eat anything else?');
    });
    await act(async () => {
      last = await result.current.processUserTurn('toast and eggs', 1500);
    });
    expect(last!.updatedMetrics).toMatchObject({
      totalUserWords: 7,
      turnsCompleted: 3,
      avgLatencyMs: 1200,
    });
    expect(last!.updatedMetrics.completionRate).toBeCloseTo(200 / 3);
    expect(result.current.metrics.totalUserWords).toBe(7);
    expect(result.current.metrics.turnsCompleted).toBe(3);
    expect(mocks.invoke).toHaveBeenCalledTimes(3);
    expect(mocks.insert).toHaveBeenCalledTimes(3);
  });
});
