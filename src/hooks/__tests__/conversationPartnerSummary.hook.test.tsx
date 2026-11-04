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


describe('Conversation Partner graded dialogue — one confirmed raw event per turn', () => {
  const clinicalSignal = {
    source: 'llm' as const,
    onTopicScore: 0.9,
    targetAchievementScore: 0.8,
    responseQualityScore: 0.7,
    successScore: 0.8,
    confidence: 0.9,
    errorType: 'fluent_correct' as const,
    recommendedAdaptation: 'hold' as const,
    reasoning: 'controlled fixture',
  };

  it('uses the fixed related follow-up and stores one correctly labeled spoken L1 trial', async () => {
    const { result } = renderHook(() => useConversationPartner({
      userId: 'synthetic-user', profileId: 'synthetic-profile',
      sessionId: 'synthetic-session', maxTurns: 1,
    }));
    let response: Awaited<ReturnType<typeof result.current.processUserTurn>> | null = null;
    await act(async () => {
      response = await result.current.processUserTurn('water', 750, {
        scriptedFollowupText: 'Thank you for talking with me.',
        clinical: { level: 1, support: 'choice_based', signal: clinicalSignal, meetsTarget: true },
      });
    });
    expect(response).toMatchObject({ followupText: 'Thank you for talking with me.', eventSaved: true });
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    const event = mocks.insert.mock.calls[0][0];
    expect(event).toMatchObject({
      session_id: 'synthetic-session',
      exercise_slug: 'conversation_partner',
      round: 1,
      score: 100,
      inputs: { user_text: 'water', word_count: 1, clinical_level: 1,
        response_mode: 'spoken', support_used: 'choice_based' },
      outputs: { clinical_practice: {
        level: 1, target_met: true, scoring_valid: true,
        scorer_source: 'llm', support_used: 'choice_based',
      } },
    });
  });

  it('never reports unscorable fallback as a successful spoken clinical trial', async () => {
    const { result } = renderHook(() => useConversationPartner({
      userId: 'synthetic-user', profileId: 'synthetic-profile',
      sessionId: 'synthetic-session', maxTurns: 1,
    }));
    await act(async () => {
      await result.current.processUserTurn('water', 750, {
        scriptedFollowupText: 'Thank you for talking with me.',
        clinical: {
          level: 1, support: 'independent',
          signal: { ...clinicalSignal, source: 'fallback' },
          meetsTarget: false,
        },
      });
    });
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({
      score: null, error_type: 'unscorable',
      outputs: { clinical_practice: { target_met: false, scoring_valid: false,
        scorer_source: 'fallback' } },
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('returns eventSaved false when the backend explicitly rejects the clinical turn', async () => {
    mocks.insert.mockResolvedValueOnce({ data: null, error: { message: 'synthetic RLS denial' } as never });
    const { result } = renderHook(() => useConversationPartner({
      userId: 'synthetic-user', profileId: 'synthetic-profile',
      sessionId: 'synthetic-session', maxTurns: 1,
    }));
    let response: Awaited<ReturnType<typeof result.current.processUserTurn>> | null = null;
    await act(async () => {
      response = await result.current.processUserTurn('water', 750, {
        scriptedFollowupText: 'Thank you for talking with me.',
        clinical: { level: 1, support: 'independent', signal: clinicalSignal, meetsTarget: true },
      });
    });
    expect(response?.eventSaved).toBe(false);
  });
});
