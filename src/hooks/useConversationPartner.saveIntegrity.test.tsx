import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  insert: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    from: () => ({ insert: mocks.insert }),
  },
}));

import { useConversationPartner } from './useConversationPartner';

describe('Conversation Partner raw clinical event integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockResolvedValue({ data: { fallbackType: 'tell_more' }, error: null });
    mocks.insert.mockResolvedValue({ error: null });
  });
  afterEach(() => cleanup());

  it('logs distinct turn indices and excludes unvalidated word-count from speech mastery', async () => {
    const { result } = renderHook(() => useConversationPartner({
      userId: 'synthetic-user', profileId: 'synthetic-profile',
      sessionId: 'synthetic-session', maxTurns: 3,
    }));
    let first: unknown = null;
    let second: unknown = null;
    act(() => result.current.addAITurn('What did you have for breakfast?'));
    await act(async () => {
      first = await result.current.processUserTurn('Toast and eggs', 2400);
    });
    act(() => result.current.addAITurn('Did you enjoy it?'));
    await act(async () => {
      second = await result.current.processUserTurn('Yes, very much', 1500);
    });

    expect((first as { eventSaved?: boolean }).eventSaved).toBe(true);
    expect((second as { eventSaved?: boolean }).eventSaved).toBe(true);
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    const [one, two] = mocks.insert.mock.calls.map(args => args[0] as Record<string, any>);
    expect(one).toMatchObject({
      session_id: 'synthetic-session',
      exercise_slug: 'conversation_partner',
      round: 1,
      counts_toward_score: false,
      task_parameters: {
        trial_mode: 'production',
        clinical_progression_eligible: false,
        independent_spoken_score_eligible: false,
      },
    });
    expect(two).toMatchObject({
      session_id: 'synthetic-session',
      exercise_slug: 'conversation_partner',
      round: 2,
      counts_toward_score: false,
    });
  });

  it('reports a rejected raw write instead of silently declaring it saved', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'synthetic RLS denial' } });
    const { result } = renderHook(() => useConversationPartner({
      userId: 'u', profileId: 'p', sessionId: 'synthetic-session',
    }));
    let response: unknown = null;
    await act(async () => {
      response = await result.current.processUserTurn('I made coffee', 900);
    });
    expect((response as { eventSaved?: boolean }).eventSaved).toBe(false);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it('does not claim a verified save when there is no session ID', async () => {
    const { result } = renderHook(() => useConversationPartner({
      userId: 'u', profileId: 'p', sessionId: null,
    }));
    let response: unknown = null;
    await act(async () => {
      response = await result.current.processUserTurn('Hello there', 950);
    });
    expect((response as { eventSaved?: boolean }).eventSaved).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
